const DEFAULT_TIMEOUT_SECS = 180;
const API_BASE = "https://api.apify.com/v2";

export class ApifyError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApifyError";
    this.status = status;
  }
}

export function getToken(env: NodeJS.ProcessEnv = process.env): string {
  const token = env.APIFY_TOKEN?.trim();
  if (!token) {
    throw new ApifyError(
      401,
      "APIFY_TOKEN is not set. Create a token in your Apify account settings and pass it as the APIFY_TOKEN environment variable. This server does not ship with a token.",
    );
  }
  return token;
}

export function redact(text: string, token: string): string {
  return token && text.includes(token) ? text.split(token).join("[redacted]") : text;
}

export async function runActor<T = Record<string, unknown>>(
  actorId: string,
  input: unknown,
  options: {
    token?: string;
    timeoutSecs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<T[]> {
  const token = options.token ?? getToken();
  const timeoutSecs = options.timeoutSecs ?? DEFAULT_TIMEOUT_SECS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${API_BASE}/acts/${actorId}/run-sync-get-dataset-items?timeout=${timeoutSecs}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), (timeoutSecs + 15) * 1000);
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(input ?? {}),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new ApifyError(408, `Timed out waiting for ${actorId} after ${timeoutSecs}s.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const raw = redact(await res.text(), token);

  if (!res.ok) {
    let detail = raw.slice(0, 500);
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string };
      detail = parsed.error?.message ?? parsed.message ?? detail;
    } catch {
      // keep the sliced body
    }
    if (res.status === 401 || res.status === 403) {
      throw new ApifyError(res.status, "Apify rejected the token. Check that APIFY_TOKEN is a valid personal API token.");
    }
    throw new ApifyError(res.status, `Apify run of ${actorId} failed (${res.status}): ${detail}`);
  }

  if (!raw) return [];
  const data = JSON.parse(raw) as unknown;
  if (!Array.isArray(data)) {
    throw new ApifyError(502, `Unexpected response from ${actorId}: expected a JSON array of dataset items.`);
  }
  return data as T[];
}

export function asUrlObjects(urls: string[] | undefined): { url: string }[] | undefined {
  if (!urls?.length) return undefined;
  return urls.map((url) => ({ url }));
}

export function compact<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as T;
}
