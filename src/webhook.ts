// Tegro.Money webhook verifier.
//
// Signature scheme (per tegro.money/docs/en/payments/signature/, 2026-05-14):
//   1. Drop the `sign` field from incoming form-data/JSON.
//   2. Sort the remaining fields alphabetically by key.
//   3. URL-encode as `key=value&key=value&...` (URLSearchParams matches PHP http_build_query).
//   4. expected_sign = md5(query + SECRET_KEY)  // lowercase hex
//   5. Constant-time compare expected_sign vs body.sign.

import { createHash, timingSafeEqual } from "node:crypto";
import type { TegroNotifyFields, VerifiedNotification } from "./types.js";

function buildQueryForSign(fields: Record<string, string>): string {
  const sortedKeys = Object.keys(fields).sort();
  const params = new URLSearchParams();
  for (const key of sortedKeys) {
    const v = fields[key];
    if (v === undefined) continue;
    params.append(key, v);
  }
  return params.toString();
}

/** Verify an incoming Tegro webhook payload. Returns parsed fields on success, throws on bad sig. */
export function verifyAndParseNotification(
  rawFields: Record<string, string | undefined>,
  secretKey: string,
): VerifiedNotification {
  const providedSign = rawFields.sign;
  if (!providedSign) throw new WebhookSignatureError("missing_sign");

  const fieldsForSign: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawFields)) {
    if (k === "sign") continue;
    if (v === undefined || v === null) continue;
    fieldsForSign[k] = String(v);
  }

  const query = buildQueryForSign(fieldsForSign);
  const expected = createHash("md5").update(query + secretKey).digest("hex").toLowerCase();
  const got = providedSign.toLowerCase();

  if (expected.length !== got.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(got))) {
    throw new WebhookSignatureError("bad_signature");
  }

  const orderId = rawFields.order_id;
  const amountStr = rawFields.amount;
  if (!orderId || !amountStr) throw new WebhookSignatureError("missing_required_fields");

  const amountRub = Number(amountStr);
  if (!Number.isFinite(amountRub) || amountRub <= 0) throw new WebhookSignatureError("bad_amount");

  return {
    shopId: rawFields.shop_id ?? "",
    amountRub,
    orderId,
    paymentSystem: rawFields.payment_system ?? "",
    currency: rawFields.currency ?? "RUB",
    paymentId: rawFields.payment_id ?? null,
    isTest: rawFields.test === "1" || rawFields.test === "true",
  };
}

export class WebhookSignatureError extends Error {
  constructor(public code: string) {
    super(`tegro_webhook_${code}`);
    this.name = "WebhookSignatureError";
  }
}
