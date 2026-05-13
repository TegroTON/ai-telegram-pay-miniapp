// Type definitions for Tegro.Money API.
// Sources verified 2026-05-14:
//   https://tegro.money/docs/en/api/
//   https://tegro.money/docs/en/api/create-order/
//   https://tegro.money/docs/en/api/balance/
//   https://tegro.money/docs/en/api/check-order/
//   https://tegro.money/docs/en/api/list-orders/
//   https://tegro.money/docs/en/payments/notify/
//   https://tegro.money/docs/en/payments/signature/

export interface TegroConfig {
  /** Public Shop ID (32-hex). Visible in cabinet → Shop settings. */
  shopId: string;
  /** API key — used as HMAC-SHA256 secret for outgoing request signing. */
  apiKey: string;
  /** Secret key — used to verify incoming webhook MD5 signature. */
  secretKey: string;
}

export interface ReceiptItem {
  name: string;
  count: number;
  price: number;
}

export interface CreateOrderRequest {
  /** Three-letter currency: "RUB" | "USD" | "EUR" (RUB is most common). */
  currency: "RUB" | "USD" | "EUR";
  /** Order total. Use a number, e.g. 1200 or 1200.50 (NOT a string). */
  amount: number;
  /** Your internal order id — echoed back in the webhook so you can attribute the payment. */
  orderId: string;
  /** Optional — force a specific payment method (see Tegro cabinet for IDs). */
  paymentSystem?: number;
  /** Optional — buyer's email/phone shown on the hosted payment page. */
  fields?: { email?: string; phone?: string };
  /** Optional — shopping cart breakdown for receipts. */
  receipt?: { items: ReceiptItem[] };
}

export interface CreateOrderResponse {
  /** Tegro internal order id. */
  id: number;
  /** Hosted payment URL — redirect the user here. */
  url: string;
}

/** Balance response — multi-currency wallet snapshot for the merchant account. */
export interface BalanceResponse {
  /** Tegro internal user id (owner of the wallet). */
  user_id: number;
  /** Amounts are decimal strings (don't coerce to number for accounting precision). */
  balance: {
    RUB?: string;
    USD?: string;
    EUR?: string;
    UAH?: string;
  } & Record<string, string | undefined>;
}

/** Look up a single order — by Tegro `order_id` OR your own `payment_id`. */
export interface CheckOrderRequest {
  /** Tegro's order id (preferred when you have it). */
  order_id?: number;
  /** Your internal order id (the value you passed to createOrder as `orderId`). */
  payment_id?: string;
}

/**
 * Order status enum (per docs):
 *   0 = new (created, awaiting payment)
 *   1 = paid (successful)
 *   2 = failed
 *   3 = refunded
 *   4 = pending (in processing)
 *   ...
 * Treat as opaque numbers and rely on the helpers below.
 */
export type OrderStatus = number;

export interface OrderRecord {
  id: number;
  date_created: string;
  date_payed: string | null;
  status: OrderStatus;
  payment_system_id: number;
  currency_id: number;
  /** Decimal string. */
  amount: string;
  /** Decimal string. */
  fee: string;
  email: string;
  test_order: 0 | 1;
  /** Your internal id (echoes what you passed as `orderId` on createOrder). */
  payment_id: string;
}

export interface ListOrdersRequest {
  /** Optional 1-based page index. */
  page?: number;
}

export interface ListOrdersResponse {
  items: OrderRecord[];
}

export interface TegroNotifyFields {
  shop_id: string;
  amount: string;
  order_id: string;
  payment_system: string;
  currency: string;
  /** "1" if this is a test webhook. */
  test?: string;
  /** Optional — Tegro's internal payment id. */
  payment_id?: string;
  /** MD5(ksort+query + SECRET_KEY) lowercase hex. */
  sign: string;
  /** Forward-compatible: tegro may add more fields. */
  [key: string]: string | undefined;
}

export interface VerifiedNotification {
  shopId: string;
  amountRub: number;
  orderId: string;
  paymentSystem: string;
  currency: string;
  paymentId: string | null;
  isTest: boolean;
}
