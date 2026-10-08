# Local secrets across git worktrees (direnv)

This repo uses several gitignored local secrets files:

- `.env` — used by `scripts/*.ts` (via their own `loadEnvFile()` helpers) and by Astro/Vite for anything read off `process.env`.
- `.dev.vars` — read directly by Wrangler (`npm run preview`, `wrangler pages dev`) to populate Cloudflare bindings locally. See `docs/CLOUDFLARE_ENV_VARS.md`.
- `.keys/` — raw credential files read directly off disk by some scripts/tools (e.g. `tools/eventbrite.py` reads `.keys/eventbrite.json`).

Because these are gitignored, `git worktree add` never brings them into a new worktree — only tracked files get checked out. Copying them by hand into every new worktree works, but drifts over time (rotate a key in one place, forget the others) and isn't something you want happening via automation/agents that might echo secret contents into logs.

This repo's committed [`.envrc`](../.envrc) fixes that with [direnv](https://direnv.net/): it contains no secrets, just points at a single canonical secrets directory on your machine and wires the current worktree up to it automatically.

## One-time machine setup

1. Install direnv and hook it into your shell (once per machine):

   ```sh
   brew install direnv
   # zsh — add to ~/.zshrc:
   eval "$(direnv hook zsh)"
   ```

   (bash: add the bash equivalent to `~/.bashrc` instead — see the [direnv docs](https://direnv.net/docs/hook.html).)

2. Create the canonical secrets directory and populate it from wherever your existing secrets already live (e.g. your primary checkout):

   ```sh
   mkdir -p ~/.config/made_evo
   cp /path/to/existing/checkout/.env       ~/.config/made_evo/env
   cp /path/to/existing/checkout/.dev.vars  ~/.config/made_evo/dev.vars
   cp -R /path/to/existing/checkout/.keys   ~/.config/made_evo/keys
   ```

   This is the only step that touches actual secret values — do it yourself in a real terminal, not through an agent/automation tool call.

## Per-worktree setup

Every time you create a new worktree (`git worktree add ...`), just run:

```sh
cd path/to/new/worktree
direnv allow
```

That's it. On `direnv allow`, and every time you `cd` into the worktree afterwards, `.envrc` will:

- Export every `KEY=VALUE` pair from `~/.config/made_evo/env` as real shell environment variables (so `process.env.X` works in scripts/dev server without a physical `.env` file existing in the worktree at all).
- Symlink `~/.config/made_evo/dev.vars` → `./.dev.vars` and `~/.config/made_evo/keys` → `./.keys`, since Wrangler and some scripts need those as physical files on disk rather than environment variables.

direnv requires an explicit `direnv allow` for every distinct directory before it will execute its `.envrc` (a deliberate security measure — it won't silently run arbitrary shell code from a directory you haven't approved), so this one-time-per-worktree step is expected and by design.

## Updating secrets later

Rotate/update files in `~/.config/made_evo/` only — every worktree symlinked/direnv-loaded from it picks up the change immediately (re-`cd` into the worktree, or run `direnv reload`, to re-export `.env`-derived variables into your current shell session).

## Gotcha: multi-line values (e.g. `GOOGLE_SERVICE_ACCOUNT_JSON`) will break `env`

`~/.config/made_evo/env` is loaded with direnv's `dotenv_if_exists`, which is much stricter than the ad-hoc `loadEnvFile()` parser the `scripts/*.ts` files use themselves — it expects one `KEY=VALUE` per line. If a value is a raw, pretty-printed JSON blob pasted across multiple physical lines (most commonly `GOOGLE_SERVICE_ACCOUNT_JSON`, a full Google service-account credentials JSON), `cd`ing into the worktree will fail with something like:

```
direnv: error invalid line: {
```

**Fix: store the blob as its own file under `~/.config/made_evo/keys/`, and point the env var at that path instead of inlining the JSON.** This works out of the box for `GOOGLE_SERVICE_ACCOUNT_JSON` specifically because `getGoogleCredentials()` (`src/lib/google-sheets.ts`) already falls back to treating the value as a file path (resolved relative to `process.cwd()`) whenever `JSON.parse` on it fails:

```sh
# 1. Move the JSON blob into its own file (keep it out of `env` entirely):
#    ~/.config/made_evo/keys/google-service-account.json

# 2. In ~/.config/made_evo/env, replace the multi-line entry with a single line:
GOOGLE_SERVICE_ACCOUNT_JSON=.keys/google-service-account.json
```

Since `.keys/` is symlinked into every worktree by `.envrc`, this path resolves correctly everywhere without duplicating the JSON per worktree.

If you add a new secret that's inherently multi-line (a PEM private key, another service-account JSON, etc.), follow the same pattern: put it in its own file under `~/.config/made_evo/keys/` (or `~/.config/made_evo/dev.vars` if it's Cloudflare-only and the consuming code expects it inline there) rather than pasting it into `env` directly.

To sanity-check `~/.config/made_evo/env` for other lines that don't look like `KEY=VALUE`/comments/blanks — without printing any actual secret values — run:

```sh
awk '{ if ($0 !~ /^[A-Za-z_][A-Za-z0-9_]*=/ && $0 !~ /^[[:space:]]*#/ && $0 !~ /^[[:space:]]*$/) print "line " NR ": does not look like KEY=VALUE" }' ~/.config/made_evo/env
```
