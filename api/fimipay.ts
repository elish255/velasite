import { handleUnifiedFimipayApi } from "../src/lib/fimipay-handlers.server";
import { requestBody, sendResponse, toWebRequest, type VercelRequest, type VercelResponse } from "./_fimipay";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const body = await requestBody(req);
    await sendResponse(res, await handleUnifiedFimipayApi(await toWebRequest(req, body)));
  } catch (error) {
    console.error("/api/fimipay error", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Internal server error" }));
  }
}
