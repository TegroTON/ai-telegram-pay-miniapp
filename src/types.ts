// Type definitions for Tegro.Money API.
// Sources verified 2026-05-14:
//   https://tegro.money/docs/en/api/
//   https://tegro.money/docs/en/api/create-order/
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
