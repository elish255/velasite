import { handleFimipayWebhook } from "../../src/lib/fimipay-handlers.server";
import { requestBody, sendResponse, toWebRequest, type VercelRequest, type VercelResponse } from "../_fimipay";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const body = await requestBody(req);
    const webRequest = await toWebRequest(req, body);
    await sendResponse(res, await handleFimipayWebhook(webRequest));
  } catch (error) {
    console.error("/api/fimipay/webhook error", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Internal server error" }));
  }
}
