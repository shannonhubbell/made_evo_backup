#!/usr/bin/env tsx
/**
 * Query GitHub Issues for this repo
 *
 * A thin data-fetching layer for the "pick an issue to work on" workflow: this script
 * only lists/fetches issues - the interactive selection and prompt-generation happen
 * in conversation with the coding agent (it reads `--json` output, asks which issue to
 * tackle, then synthesizes a kickoff prompt from the actual issue body/comments rather
 * than a mechanical template).
 *
 * Usage:
 *   tsx scripts/github-issues.ts [--state=open|closed|all] [--label=bug] [--limit=30] [--json]
 *   tsx scripts/github-issues.ts --issue=123 [--json]
 *
 * Requires a GITHUB_TOKEN in .env with at least "Issues: Read-only" + "Metadata:
 * Read-only" repository permissions (this repo is private, so unauthenticated requests
 * 404). Create one at https://github.com/settings/tokens?type=beta, scoped to just this
 * repository - don't reuse a token that also has write/dispatch permissions for this
 * read-only listing tool.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

function loadEnv(): Record<string, string> {
  const envPath = join(projectRoot, ".env");
  try {
    const envContent = readFileSync(envPath, "utf-8");
    const env: Record<string, string> = {};
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts
            .join("=")
            .trim()
            .replace(/^["']|["']$/g, "");
        }
      }
    }
    return { ...env, ...(process.env as Record<string, string>) };
  } catch {
    return process.env as Record<string, string>;
  }
}

const env = loadEnv();
const GITHUB_TOKEN = env.GITHUB_TOKEN || "";
const GITHUB_OWNER = "Museum-of-Art-and-Digital-Entertainment";
const GITHUB_REPO = "made_evo";

const args = process.argv.slice(2);
function getArg(name: string, defaultValue?: string): string | undefined {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : defaultValue;
}
const JSON_OUTPUT = args.includes("--json");
const STATE = getArg("state", "open");
const LABEL = getArg("label");
const LIMIT = parseInt(getArg("limit", "30")!, 10);
const ISSUE_NUMBER = getArg("issue");

interface SimplifiedIssue {
  number: number;
  title: string;
  url: string;
  state: string;
  labels: string[];
  comments: number;
  createdAt: string;
  updatedAt: string;
  author: string;
  body: string | null;
}

interface SimplifiedComment {
  author: string;
  createdAt: string;
  body: string;
}

async function gh(pathname: string): Promise<Response> {
  if (!GITHUB_TOKEN) {
    console.error("Error: GITHUB_TOKEN not set in .env");
    console.error(
      "Create a fine-grained PAT (Issues: Read-only, Metadata: Read-only) scoped to this repo at:"
    );
    console.error("  https://github.com/settings/tokens?type=beta");
    process.exit(1);
  }
  const res = await fetch(`https://api.github.com${pathname}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": `${GITHUB_REPO}-issue-picker`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`GitHub API error: ${res.status} ${text}`);
    process.exit(1);
  }
  return res;
}

function simplifyIssue(raw: any): SimplifiedIssue {
  return {
    number: raw.number,
    title: raw.title,
    url: raw.html_url,
    state: raw.state,
    labels: (raw.labels || []).map((l: any) => (typeof l === "string" ? l : l.name)),
    comments: raw.comments,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    author: raw.user?.login || "unknown",
    body: raw.body,
  };
}

async function listIssues(): Promise<void> {
  const params = new URLSearchParams({
    state: STATE!,
    per_page: String(Math.min(LIMIT, 100)),
    sort: "updated",
    direction: "desc",
  });
  if (LABEL) params.set("labels", LABEL);

  const res = await gh(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues?${params}`);
  const data = (await res.json()) as any[];

  // The /issues endpoint also returns PRs (they're issues under the hood) - exclude them.
  const issues = data.filter((item) => !item.pull_request).map(simplifyIssue).slice(0, LIMIT);

  if (JSON_OUTPUT) {
    console.log(JSON.stringify(issues, null, 2));
    return;
  }

  if (issues.length === 0) {
    console.log(`No ${STATE} issues found${LABEL ? ` with label "${LABEL}"` : ""}.`);
    return;
  }

  console.log(`${issues.length} ${STATE} issue(s)${LABEL ? ` labeled "${LABEL}"` : ""}:\n`);
  for (const issue of issues) {
    const labelStr = issue.labels.length ? ` [${issue.labels.join(", ")}]` : "";
    console.log(`#${issue.number} ${issue.title}${labelStr}`);
    console.log(
      `   updated ${issue.updatedAt.slice(0, 10)} · ${issue.comments} comment(s) · ${issue.url}`
    );
  }
}

async function showIssue(number: string): Promise<void> {
  const [issueRes, commentsRes] = await Promise.all([
    gh(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${number}`),
    gh(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${number}/comments`),
  ]);
  const issue = simplifyIssue(await issueRes.json());
  const comments: SimplifiedComment[] = ((await commentsRes.json()) as any[]).map((c) => ({
    author: c.user?.login || "unknown",
    createdAt: c.created_at,
    body: c.body,
  }));

  if (JSON_OUTPUT) {
    console.log(JSON.stringify({ ...issue, commentsDetail: comments }, null, 2));
    return;
  }

  console.log(`#${issue.number} ${issue.title}`);
  console.log(`${issue.url}`);
  console.log(`by ${issue.author} · ${issue.state} · labels: ${issue.labels.join(", ") || "none"}\n`);
  console.log(issue.body || "(no description)");
  if (comments.length > 0) {
    console.log(`\n--- ${comments.length} comment(s) ---`);
    for (const c of comments) {
      console.log(`\n${c.author} (${c.createdAt.slice(0, 10)}):\n${c.body}`);
    }
  }
}

async function main() {
  if (ISSUE_NUMBER) {
    await showIssue(ISSUE_NUMBER);
  } else {
    await listIssues();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
