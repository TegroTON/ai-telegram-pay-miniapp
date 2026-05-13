import { describe, it, expect } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { signRequestBody } from "../src/client.js";
import { verifyAndParseNotification, WebhookSignatureError } from "../src/webhook.js";

describe("signRequestBody (HMAC-SHA256)", () => {
  it("matches PHP hash_hmac('sha256', body, key) reference", () => {
    const apiKey = "EEFA1913EA9D9351469B1E5D852A";
    const body = '{"shop_id":"1913EA9D9351469B1E5D852A","nonce":1613435880}';
    const expected = createHmac("sha256", apiKey).update(body).digest("hex");
    expect(signRequestBody(body, apiKey)).toBe(expected);
  });
});

describe("verifyAndParseNotification (MD5 ksort)", () => {
  const secret = "test_secret_key";

  function makeSignedFields(fields: Record<string, string>): Record<string, string> {
    // Same algorithm as PHP: ksort → http_build_query → md5(query + SECRET)
    const sorted = Object.keys(fields).sort();
    const params = new URLSearchParams();
    for (const k of sorted) params.append(k, fields[k]!);
    const query = params.toString();
    const sign = createHash("md5").update(query + secret).digest("hex");
    return { ...fields, sign };
  }

  it("accepts a valid signature", () => {
    const signed = makeSignedFields({
      shop_id: "1E35370E996A6625EBA8ABE5DDD0B271",
      amount: "100.00",
      currency: "RUB",
      order_id: "deposit-abc-123",
      payment_system: "5",
    });
    const result = verifyAndParseNotification(signed, secret);
    expect(result.orderId).toBe("deposit-abc-123");
    expect(result.amountRub).toBe(100);
    expect(result.isTest).toBe(false);
  });

  it("rejects a tampered amount", () => {
    const signed = makeSignedFields({
      shop_id: "shop",
      amount: "100.00",
      currency: "RUB",
      order_id: "x",
      payment_system: "5",
    });
    signed.amount = "999.99"; // tamper
    expect(() => verifyAndParseNotification(signed, secret)).toThrow(WebhookSignatureError);
  });

  it("flags test webhooks", () => {
    const signed = makeSignedFields({
      shop_id: "s",
      amount: "1.00",
      currency: "RUB",
      order_id: "test-1",
      payment_system: "5",
      test: "1",
    });
    expect(verifyAndParseNotification(signed, secret).isTest).toBe(true);
  });

  it("ignores unknown extra fields by including them in the sig", () => {
    const signed = makeSignedFields({
      shop_id: "s",
      amount: "10.00",
      currency: "RUB",
      order_id: "x",
      payment_system: "5",
      payment_id: "tegro-internal-id",
    });
    expect(verifyAndParseNotification(signed, secret).paymentId).toBe("tegro-internal-id");
  });
});
