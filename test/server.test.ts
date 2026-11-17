import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";

import { createServer, SERVER_NAME, SERVER_VERSION } from "../src/server.js";
import { ACTORS, tools, webPageInput } from "../src/tools.js";

const TOOL_NAMES = [
  "ats_job_listings",
  "sam_gov_contract_opportunities",
  "sitemap_change_monitor",
  "web_page_to_markdown",
  "site_to_markdown_crawler",
  "bulk_website_screenshot",
] as const;

describe("tool catalog", () => {
  it("exports exactly the six DatLab actors", () => {
    expect(tools.map((t) => t.name)).toEqual([...TOOL_NAMES]);
    expect(new Set(Object.values(ACTORS)).size).toBe(6);
    for (const id of Object.values(ACTORS)) {
      expect(id.startsWith("datlab~")).toBe(true);
    }
  });

  it("accepts a plain URL list for web_page_to_markdown and rejects an empty url", () => {
    expect(webPageInput.parse({ urls: ["https://example.com"] }).urls).toEqual(["https://example.com"]);
    expect(() => webPageInput.parse({ urls: [""] })).toThrow();
  });
});

describe("MCP server", () => {
  async function connect() {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "0.0.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    return { client, server };
  }

  it("lists six tools and starts with no APIFY_TOKEN", async () => {
    const prev = process.env.APIFY_TOKEN;
    delete process.env.APIFY_TOKEN;
    const { client, server } = await connect();
    try {
      const listed = await client.listTools();
      expect(listed.tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
      const page = listed.tools.find((t) => t.name === "web_page_to_markdown");
      expect(page?.description).toMatch(/known URLs/i);
      expect(page?.inputSchema).toBeTruthy();
    } finally {
      await client.close();
      await server.close();
      if (prev !== undefined) process.env.APIFY_TOKEN = prev;
    }
  });

  it("returns a clear error when a tool is called with no token", async () => {
    const prev = process.env.APIFY_TOKEN;
    delete process.env.APIFY_TOKEN;
    const { client, server } = await connect();
    try {
      const result = await client.callTool({
        name: "web_page_to_markdown",
        arguments: { urls: ["https://example.com"] },
      });
      expect(result.isError).toBe(true);
      const text = (result.content as { type: string; text: string }[])[0].text;
      expect(text).toMatch(/APIFY_TOKEN is not set/);
      expect(text).not.toMatch(/apify_api_/);
    } finally {
      await client.close();
      await server.close();
      if (prev !== undefined) process.env.APIFY_TOKEN = prev;
    }
  });

  it("maps web_page_to_markdown URLs onto the actor input and returns items", async () => {
    const token = "apify_api_testtoken_not_real_xxxxxxxxxxxxxxxxxxxx";
    process.env.APIFY_TOKEN = token;
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toContain(`/${ACTORS.webPageToMarkdown}/run-sync-get-dataset-items`);
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe(`Bearer ${token}`);
      expect(JSON.parse(String(init?.body))).toEqual({
        startUrls: [{ url: "https://example.com" }],
        scrapingTool: "raw-http",
      });
      return new Response(JSON.stringify([{ url: "https://example.com/", markdown: "Example Domain", wordCount: 25 }]), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchImpl);

    const { client, server } = await connect();
    try {
      const result = await client.callTool({
        name: "web_page_to_markdown",
        arguments: { urls: ["https://example.com"], scrapingTool: "raw-http" },
      });
      expect(result.isError).toBeFalsy();
      const payload = JSON.parse((result.content as { type: string; text: string }[])[0].text);
      expect(payload.itemCount).toBe(1);
      expect(payload.items[0].wordCount).toBe(25);
      expect(JSON.stringify(result)).not.toContain(token);
    } finally {
      await client.close();
      await server.close();
      vi.unstubAllGlobals();
      delete process.env.APIFY_TOKEN;
    }
  });

  it("identifies itself as datlab-mcp", () => {
    expect(SERVER_NAME).toBe("datlab-mcp");
    expect(SERVER_VERSION).toBe("0.1.0");
  });
});
