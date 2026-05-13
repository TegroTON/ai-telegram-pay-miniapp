// Tegro.Money API client — createOrder + balance/check/list + signing helpers.
//
// Authentication scheme (per tegro.money/docs/en/api/, 2026-05-14):
//   Authorization: Bearer <HMAC-SHA256(rawJsonBody, API_KEY)>   // hex, lowercase
//
// All requests are POST with a JSON body that MUST include:
//   shop_id (string)
//   nonce   (integer, unique per request — Date.now() is fine)

import { createHmac } from "node:crypto";
import type {
  TegroConfig,
  CreateOrderRequest,
  CreateOrderResponse,
  BalanceResponse,
  CheckOrderRequest,
  OrderRecord,
  ListOrdersRequest,
  ListOrdersResponse,
} from "./types.js";

const DEFAULT_API_BASE = "https://tegro.money/api";

/** HMAC-SHA256 of the raw JSON body using the API key as secret. Hex, lowercase. */
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

interface TegroEnvelope<T> {
  type?: "success" | "error" | string;
  desc?: string;
  data?: T;
}

export class TegroClient {
  constructor(private cfg: TegroConfig, private opts: TegroClientOptions = {}) {}

  /** Create a hosted-payment order. Returns the URL to redirect the user to. */
  async createOrder(req: CreateOrderRequest): Promise<CreateOrderResponse> {
    const body = {
      shop_id: this.cfg.shopId,
      nonce: this.nextNonce(),
      currency: req.currency,
      amount: req.amount,
      order_id: req.orderId,
      ...(req.paymentSystem !== undefined && { payment_system: req.paymentSystem }),
      ...(req.fields && { fields: req.fields }),
      ...(req.receipt && { receipt: req.receipt }),
    };
    const data = await this.post<CreateOrderResponse>("/createOrder/", body);
    if (!data.url) throw new TegroApiError("createOrder returned no url", 200, data);
    return data;
  }

  /** Multi-currency wallet balance for the merchant account. */
  async balance(): Promise<BalanceResponse> {
    return this.post<BalanceResponse>("/balance/", {
      shop_id: this.cfg.shopId,
      nonce: this.nextNonce(),
    });
  }

  /** Look up a single order — either by Tegro's `order_id` or your `payment_id`. */
  async checkOrder(req: CheckOrderRequest): Promise<OrderRecord> {
    if (req.order_id === undefined && !req.payment_id) {
      throw new TegroApiError("checkOrder: order_id OR payment_id required", 0, req);
    }
    return this.post<OrderRecord>("/order/", {
      shop_id: this.cfg.shopId,
      nonce: this.nextNonce(),
      ...(req.order_id !== undefined && { order_id: req.order_id }),
      ...(req.payment_id !== undefined && { payment_id: req.payment_id }),
    });
  }

  /** List shop's orders, paginated. Pages are 1-based. */
  async listOrders(req: ListOrdersRequest = {}): Promise<ListOrdersResponse> {
    const body = {
      shop_id: this.cfg.shopId,
      nonce: this.nextNonce(),
      ...(req.page !== undefined && { page: req.page }),
    };
    // Tegro returns the array directly under `data`. Wrap it so the surface
    // can grow without a breaking change (e.g. add total / per_page later).
    const arr = await this.post<OrderRecord[]>("/orders/", body);
    return { items: Array.isArray(arr) ? arr : [] };
  }

  // ---- internal --------------------------------------------------------

  private nextNonce(): number {
    return (this.opts.nonce ?? Date.now)();
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const json = JSON.stringify(body);
    const sign = signRequestBody(json, this.cfg.apiKey);
    const f = this.opts.fetch ?? fetch;
    const apiBase = this.opts.apiBase ?? DEFAULT_API_BASE;
    const res = await f(`${apiBase}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sign}`,
      },
      body: json,
    });
    const payload = (await res.json().catch(() => ({}))) as TegroEnvelope<T>;
    if (!res.ok || payload.type !== "success" || payload.data === undefined) {
      throw new TegroApiError(payload.desc ?? `HTTP ${res.status}`, res.status, payload);
    }
    return payload.data;
  }
}

export class TegroApiError extends Error {
  constructor(message: string, public status: number, public raw: unknown) {
    super(`tegro_api_error:${message}`);
    this.name = "TegroApiError";
  }
}

// ---- order-status helpers ----------------------------------------------
// Tegro docs publish numeric statuses without an enum; these helpers paper
// over that without leaking magic numbers across consumer code.

/** Status 1 = successful payment, per docs. */
export function isOrderPaid(o: { status: number }): boolean {
  return o.status === 1;
}
/** Status 0 = created, awaiting payment. */
export function isOrderPending(o: { status: number }): boolean {
  return o.status === 0;
}
/** Status 2 = payment failed. */
export function isOrderFailed(o: { status: number }): boolean {
  return o.status === 2;
}
/** Status 3 = refunded. */
export function isOrderRefunded(o: { status: number }): boolean {
  return o.status === 3;
}
