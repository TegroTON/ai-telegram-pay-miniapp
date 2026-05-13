// Tegro.Money API client — createOrder + signing helpers.
//
// Authentication scheme (per tegro.money/docs/en/api/, 2026-05-14):
//   Authorization: Bearer <HMAC-SHA256(rawJsonBody, API_KEY)>   // hex, lowercase
//
// The `nonce` field is required and MUST be unique per request.

import { createHmac } from "node:crypto";
import type { TegroConfig, CreateOrderRequest, CreateOrderResponse } from "./types.js";

const DEFAULT_API_BASE = "https://tegro.money/api";

/** HMAC-SHA256 of the raw JSON body using the API key as secret. */
export function signRequestBody(jsonBody: string, apiKey: string): string {
  return createHmac("sha256", apiKey).update(jsonBody).digest("hex");
}

export interface TegroClientOptions {
  /** Override the API base, e.g. for staging. Default: https://tegro.money/api */
  apiBase?: string;
  /** Optional override of the unique nonce. Default: Date.now(). */
  nonce?: () => number;
  /** Optional fetch — useful for tests / proxies. */
  fetch?: typeof fetch;
}

export class TegroClient {
  constructor(private cfg: TegroConfig, private opts: TegroClientOptions = {}) {}

  /** Create a hosted-payment order. Returns the URL to redirect the user to. */
  async createOrder(req: CreateOrderRequest): Promise<CreateOrderResponse> {
    const body = {
      shop_id: this.cfg.shopId,
      nonce: (this.opts.nonce ?? Date.now)(),
      currency: req.currency,
      amount: req.amount,
      order_id: req.orderId,
      ...(req.paymentSystem !== undefined && { payment_system: req.paymentSystem }),
      ...(req.fields && { fields: req.fields }),
      ...(req.receipt && { receipt: req.receipt }),
    };
    const json = JSON.stringify(body);
    const sign = signRequestBody(json, this.cfg.apiKey);

    const f = this.opts.fetch ?? fetch;
    const apiBase = this.opts.apiBase ?? DEFAULT_API_BASE;
    const res = await f(`${apiBase}/createOrder/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sign}`,
      },
      body: json,
    });

    const data = (await res.json().catch(() => ({}))) as {
      type?: string;
      desc?: string;
      data?: CreateOrderResponse;
    };

    if (!res.ok || data.type !== "success" || !data.data?.url) {
      throw new TegroApiError(
        data.desc ?? `HTTP ${res.status}`,
        res.status,
        data,
      );
    }
    return data.data;
  }
}

export class TegroApiError extends Error {
  constructor(message: string, public status: number, public raw: unknown) {
    super(`tegro_api_error:${message}`);
    this.name = "TegroApiError";
  }
}
