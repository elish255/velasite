import type { IncomingMessage, ServerResponse } from "node:http";

export type VercelRequest = IncomingMessage & { body?: unknown; method?: string; url?: string };
export type VercelResponse = ServerResponse & { statusCode: number; json?: (body: unknown) => void };

export async function requestBody(req: VercelRequest) {
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  if (typeof req.body === "string") return req.body;
  return new Promise<string>((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => { raw += chunk; });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

export async function toWebRequest(req: VercelRequest, body?: string) {
  const host = req.headers.host || "localhost";
  const url = new URL(req.url || "/", `https://${host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  return new Request(url, {
    method: req.method || "POST",
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
  });
}

export async function sendResponse(res: VercelResponse, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(await response.text());
}
