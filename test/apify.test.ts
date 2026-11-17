import { afterEach, describe, expect, it, vi } from "vitest";

import { ApifyError, asUrlObjects, compact, getToken, runActor } from "../src/apify.js";

const TOKEN = "apify_api_testtoken_not_real_xxxxxxxxxxxxxxxxxxxx";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.APIFY_TOKEN;
});

describe("getToken", () => {
  it("reads APIFY_TOKEN from the env", () => {
    expect(getToken({ APIFY_TOKEN: ` ${TOKEN} ` })).toBe(TOKEN);
  });

  it("throws a clear error when the token is missing", () => {
    expect(() => getToken({})).toThrow(/APIFY_TOKEN is not set/);
    expect(() => getToken({ APIFY_TOKEN: "  " })).toThrow(ApifyError);
  });
});

describe("runActor", () => {
  it("POSTs to run-sync-get-dataset-items with a bearer token and returns the array", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toContain("/v2/acts/datlab~web-page-to-markdown/run-sync-get-dataset-items");
      expect(String(url)).toContain("timeout=180");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
      expect(JSON.parse(String(init?.body))).toEqual({ startUrls: [{ url: "https://example.com" }] });
      return new Response(JSON.stringify([{ url: "https://example.com/", markdown: "# Example", wordCount: 25 }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const items = await runActor(
      "datlab~web-page-to-markdown",
      { startUrls: [{ url: "https://example.com" }] },
      { token: TOKEN, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(items).toEqual([{ url: "https://example.com/", markdown: "# Example", wordCount: 25 }]);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("maps 401/403 to a message that does not include the token", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: `invalid token ${TOKEN}` } }), { status: 401 }),
    );
    await expect(
      runActor("datlab~ats-job-listings", {}, { token: TOKEN, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/rejected the token/);
    try {
      await runActor("datlab~ats-job-listings", {}, { token: TOKEN, fetchImpl: fetchImpl as unknown as typeof fetch });
    } catch (err) {
      expect((err as Error).message).not.toContain(TOKEN);
    }
  });

  it("redacts the token if a failed run body contains it", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ error: { message: `boom ${TOKEN}` } }), { status: 500 }),
    );
    try {
      await runActor("datlab~ats-job-listings", {}, { token: TOKEN, fetchImpl: fetchImpl as unknown as typeof fetch });
      throw new Error("expected failure");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toMatch(/failed \(500\)/);
      expect(message).toContain("boom [redacted]");
      expect(message).not.toContain(TOKEN);
    }
  });

  it("rejects a non-array success body", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
    await expect(
      runActor("datlab~ats-job-listings", {}, { token: TOKEN, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/expected a JSON array/);
  });
});

describe("helpers", () => {
  it("wraps URL strings as {url} objects and drops empty values", () => {
    expect(asUrlObjects(["https://example.com"])).toEqual([{ url: "https://example.com" }]);
    expect(asUrlObjects([])).toBeUndefined();
    expect(asUrlObjects(undefined)).toBeUndefined();
    expect(compact({ a: 1, b: undefined, c: [], d: "ok" })).toEqual({ a: 1, d: "ok" });
  });
});
