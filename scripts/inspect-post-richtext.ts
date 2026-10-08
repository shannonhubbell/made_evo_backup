#!/usr/bin/env tsx
/**
 * Inspect the "Home" page's ContentViews and the raw rich text JSON of the
 * post referenced by the second ContentView, to see how line breaks within
 * a paragraph are represented in Contentful's rich text structure.
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function loadEnvFile() {
  const envPath = path.join(projectRoot, ".env");
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadEnvFile();

const SPACE = process.env.CONTENTFUL_SPACE_ID!;
const TOKEN = process.env.CONTENTFUL_DELIVERY_TOKEN!;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || "master";
const URL = `https://graphql.contentful.com/content/v1/spaces/${SPACE}/environments/${ENVIRONMENT}`;

async function query(gql: string, variables: Record<string, any> = {}) {
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ query: gql, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error(JSON.stringify(json.errors, null, 2));
  }
  return json.data;
}

async function main() {
  const listQuery = `
    query {
      pageCollection(limit: 20) {
        items {
          sys { id }
          name
          title
          slug
        }
      }
    }
  `;
  const listData = await query(listQuery);
  console.log(
    "All pages:",
    listData?.pageCollection?.items?.map((p: any) => ({
      name: p.name,
      title: p.title,
      slug: p.slug,
    }))
  );

  const pageQuery = `
    query {
      pageCollection(where: { name: "Page: Home" }, limit: 1) {
        items {
          sys { id }
          name
          title
          contentViewCollection {
            items {
              sys { id }
              name
              title
              type
              targetCollection {
                items {
                  ... on Post {
                    sys { id }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const pageData = await query(pageQuery);
  const page = pageData?.pageCollection?.items?.[0];
  if (!page) {
    console.error("Home page not found");
    return;
  }

  console.log("Page:", page.name, page.sys.id);
  const contentViews = page.contentViewCollection?.items || [];
  contentViews.forEach((cv: any, i: number) => {
    console.log(
      `ContentView[${i}]:`,
      cv.name,
      cv.type,
      "targets:",
      cv.targetCollection?.items
    );
  });

  const secondContentView = contentViews[1];
  if (!secondContentView) {
    console.error("No second ContentView found");
    return;
  }

  const postId = secondContentView.targetCollection?.items?.[0]?.sys?.id;
  if (!postId) {
    console.error("No post referenced in second ContentView");
    return;
  }

  console.log("\nFetching post:", postId);

  const postQuery = `
    query {
      post(id: "${postId}") {
        sys { id }
        title
        content {
          json
        }
      }
    }
  `;

  const postData = await query(postQuery);
  console.log("\nPost title:", postData?.post?.title);
  console.log("\nRaw rich text JSON:");
  console.log(JSON.stringify(postData?.post?.content?.json, null, 2));
}

main();
