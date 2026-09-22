import { handleFimipayPaymentStatus } from "../../src/lib/fimipay-handlers.server";
import { requestBody, sendResponse, toWebRequest, type VercelRequest, type VercelResponse } from "../_fimipay";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const body = undefined;
    const webRequest = await toWebRequest(req, body);
    await sendResponse(res, await handleFimipayPaymentStatus(webRequest));
  } catch (error) {
    console.error("/api/fimipay/payment-status error", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Internal server error" }));
  }
}
