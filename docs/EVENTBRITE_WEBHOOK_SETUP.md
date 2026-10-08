# Eventbrite Webhook → Contentful Sync Setup

## Overview

Whenever an event is created, updated, or its status changes on Eventbrite, we want
Contentful to stay in sync automatically instead of relying on someone to remember to
run `npm run push:eventbrite-to-contentful` by hand.

GitHub Actions can't receive a third-party webhook directly - it only reacts to events
it already knows about (`push`, `schedule`, `repository_dispatch`, ...). So the actual
flow has three parts:

```
Eventbrite webhook
  -> POST /api/webhooks/eventbrite (this site, on Cloudflare)
       - verifies a shared secret
       - triggers a GitHub `repository_dispatch` event
  -> .github/workflows/eventbrite-sync.yml
       - runs `npm run push:eventbrite-to-contentful -- --prune-orphaned`
```

The sync itself runs in GitHub Actions rather than in the Cloudflare Worker because
it's a long, sequential chain of rate-limited Contentful Management API calls (create
an image asset, poll until processed, publish, create a CallToAction, create the event
entry, publish - repeated per event) - a workload suited to a long-lived runner, not a
Worker's request/response model with a real execution-time ceiling.

## Setup

### 1. Create a GitHub Personal Access Token for dispatching

The Cloudflare Worker needs a token with permission to trigger workflows in this repo.

- **Fine-grained token (recommended)**: Settings → Developer settings → Personal access
  tokens → Fine-grained tokens. Scope it to this repository only, with repository
  permission **Contents: Read and write** (required for the `dispatches` endpoint) and
  **Actions: Read and write**.
- Copy the token - you won't be able to see it again.

### 2. Pick a webhook secret

Generate a random string (e.g. `openssl rand -hex 32`) - this is what verifies incoming
requests actually came from your configured Eventbrite webhook and not someone who
guessed the URL.

### 3. Add Cloudflare environment variables

In the Cloudflare Pages project settings → Environment Variables (see
[CLOUDFLARE_ENV_VARS.md](./CLOUDFLARE_ENV_VARS.md) for the general pattern), add for
**Production**:

```
GITHUB_DISPATCH_TOKEN=<the fine-grained PAT from step 1>
EVENTBRITE_WEBHOOK_SECRET=<the random secret from step 2>
```

For local development, add the same two to `.dev.vars`.

### 4. Add GitHub Actions repository secrets

In the repo's Settings → Secrets and variables → Actions, add whatever the sync script
itself needs (these are separate from the Cloudflare env vars above - the workflow runs
on GitHub's infrastructure, not Cloudflare):

```
EVENTBRITE_API_KEY
EVENTBRITE_ORGANIZATION_ID
CONTENTFUL_SPACE_ID
CONTENTFUL_MANAGEMENT_TOKEN
CONTENTFUL_ENVIRONMENT   # optional, defaults to "master" if omitted/blank
```

### 5. Configure the Eventbrite webhook

In Eventbrite's account settings → Webhooks, add a new webhook pointing at:

```
https://<your-domain>/api/webhooks/eventbrite?secret=<EVENTBRITE_WEBHOOK_SECRET>
```

Subscribe it to whichever actions matter (`event.published`, `event.updated`,
`event.unpublished`, `order.placed`, etc.) - the payload contents aren't used, so
subscribing to more events just means the sync runs more often, not that it behaves
differently.

## Testing

- **Manually trigger the workflow** without waiting for a real webhook: GitHub repo →
  Actions → "Sync Eventbrite Events to Contentful" → Run workflow.
- **Test the relay endpoint** directly:
  ```bash
  curl -X POST "https://<your-domain>/api/webhooks/eventbrite?secret=<EVENTBRITE_WEBHOOK_SECRET>" \
    -H "Content-Type: application/json" \
    -d '{}'
  ```
  A `202` response means it successfully triggered the workflow; check the Actions tab
  to confirm a run started.
- Wrong or missing `secret` returns `401`; a misconfigured `GITHUB_DISPATCH_TOKEN` (or
  one missing the Contents/Actions permissions above) returns `502` with the GitHub
  API's error message logged server-side.

## Troubleshooting

**`403 Request forbidden by administrative rules` (with a `documentation_url` about the
`User-Agent` header)**: GitHub's API rejects requests with no `User-Agent` header, and
Cloudflare Workers' `fetch()` doesn't send a default one the way a browser does. Already
handled in the relay endpoint's request headers - if you see this, something stripped
that header before it reached GitHub.

**`403 Resource not accessible by personal access token`**: this means GitHub reached
auth checking and rejected the token's permissions - it's a token/org configuration
issue, not a code bug. Since `Museum-of-Art-and-Digital-Entertainment` is an
organization, check in this order:

1. **Org approval status** (most common cause): go to
   `https://github.com/organizations/Museum-of-Art-and-Digital-Entertainment/settings/personal-access-tokens`
   (requires org admin access). Fine-grained tokens for org repos can sit in a "pending
   requests" state until an admin approves them, or the org may have fine-grained token
   access disabled entirely from that page.
2. **Token permissions**: on the token's settings page
   (`https://github.com/settings/tokens?type=beta`), confirm **Repository access**
   explicitly lists `made_evo` (not just "Public repositories"), and under **Repository
   permissions**, `Contents` is set to `Read and write` - GitHub's docs for the
   `repository_dispatch` endpoint require this specifically; `Actions: Read and write`
   alone is not sufficient.
3. **Fallback**: if the organization has fine-grained tokens locked down and an admin
   won't approve one, switch `GITHUB_DISPATCH_TOKEN` to a **classic** PAT with the full
   `repo` scope instead - classic tokens aren't subject to the fine-grained-token
   organization approval step.

To isolate a token problem from a Worker/code problem, call the GitHub API directly
with the token you configured:

```bash
curl -i -X POST "https://api.github.com/repos/Museum-of-Art-and-Digital-Entertainment/made_evo/dispatches" \
  -H "Authorization: Bearer <GITHUB_DISPATCH_TOKEN>" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "User-Agent: made_evo-eventbrite-webhook" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"eventbrite-webhook"}'
```

`204 No Content` means the token is fine and the workflow was triggered - check the
Actions tab. The same `403` here (outside of the Worker entirely) confirms it's a
token/org permissions issue to resolve on GitHub's side, not something in this repo's
code.
