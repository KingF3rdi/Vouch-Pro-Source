import { tool } from "ai";
import { z } from "zod";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function tryFirecrawlSearch(query: string, limit: number) {
  try {
    const { stdout } = await execAsync(
      `firecrawl search ${JSON.stringify(query)} --categories developer --limit ${limit} --json`,
      { timeout: 45_000, maxBuffer: 4 * 1024 * 1024 }
    );
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

async function duckDuckGoSearch(query: string, limit: number) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "HelixAgent/0.1" },
  });
  const data = (await res.json()) as {
    AbstractText?: string;
    AbstractURL?: string;
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: unknown[] }>;
  };
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  if (data.AbstractText && data.AbstractURL) {
    results.push({
      title: "Abstract",
      url: data.AbstractURL,
      snippet: data.AbstractText,
    });
  }
  for (const topic of data.RelatedTopics ?? []) {
    if (results.length >= limit) break;
    if (topic.FirstURL && topic.Text) {
      results.push({
        title: topic.Text.slice(0, 80),
        url: topic.FirstURL,
        snippet: topic.Text,
      });
    }
  }
  return results;
}

async function githubSearch(query: string, limit: number) {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=${limit}&sort=stars`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "HelixAgent/0.1",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    return {
      error: `GitHub search failed: ${res.status}`,
      body: (await res.text()).slice(0, 500),
    };
  }
  const data = (await res.json()) as {
    items?: Array<{
      full_name: string;
      html_url: string;
      description: string | null;
      stargazers_count: number;
      language: string | null;
    }>;
  };
  return {
    results: (data.items ?? []).map((item) => ({
      name: item.full_name,
      url: item.html_url,
      description: item.description,
      stars: item.stargazers_count,
      language: item.language,
    })),
  };
}

export function createWebTools() {
  return {
    web_search: tool({
      description:
        "Search the internet for existing libraries, docs, and code that fit the task. Prefer this before building from scratch.",
      inputSchema: z.object({
        query: z.string().min(2),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      execute: async ({ query, limit }) => {
        const firecrawl = await tryFirecrawlSearch(query, limit);
        if (firecrawl) {
          return { source: "firecrawl", data: firecrawl };
        }
        const results = await duckDuckGoSearch(query, limit);
        return { source: "duckduckgo", results };
      },
    }),

    github_code_search: tool({
      description:
        "Search GitHub repositories for existing open-source code that can be reused or adapted.",
      inputSchema: z.object({
        query: z.string().min(2),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      execute: async ({ query, limit }) => githubSearch(query, limit),
    }),

    web_fetch: tool({
      description:
        "Fetch a URL (docs, README, raw source) and return text/markdown-ish content for reuse.",
      inputSchema: z.object({
        url: z.string().url(),
        maxChars: z.number().int().positive().max(120_000).default(40_000),
      }),
      execute: async ({ url, maxChars }) => {
        const res = await fetch(url, {
          headers: { "User-Agent": "HelixAgent/0.1" },
          redirect: "follow",
        });
        const contentType = res.headers.get("content-type") ?? "";
        const text = await res.text();
        return {
          ok: res.ok,
          status: res.status,
          contentType,
          content: text.slice(0, maxChars),
          truncated: text.length > maxChars,
        };
      },
    }),
  };
}
