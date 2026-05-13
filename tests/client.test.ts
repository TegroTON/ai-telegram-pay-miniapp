import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  TegroClient,
  TegroApiError,
  isOrderPaid,
  isOrderPending,
  isOrderFailed,
  isOrderRefunded,
} from "../src/client.js";

const cfg = {
  shopId: "1E35370E996A6625EBA8ABE5DDD0B271",
  apiKey: "yyPnIwZfaE5q8xp2",
  secretKey: "LE0H51Mq",
};

function mockFetch(handler: (url: string, init: RequestInit) => unknown): typeof fetch {
  return vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
    const body = handler(String(url), init ?? {});
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
}

describe("TegroClient.createOrder", () => {
  it("signs body with HMAC-SHA256(API_KEY) and POSTs Bearer header", async () => {
    let capturedAuth = "";
    let capturedBody = "";
    const c = new TegroClient(cfg, {
      nonce: () => 1700000000,
      fetch: mockFetch((_url, init) => {
        capturedAuth = (init.headers as Record<string, string>)["Authorization"]!;
        capturedBody = init.body as string;
        return { type: "success", desc: "", data: { id: 755555, url: "https://tegro.money/pay/x" } };
      }),
    });

    const out = await c.createOrder({
      currency: "RUB",
      amount: 100,
      orderId: "test-order-1",
    });

    expect(out.url).toBe("https://tegro.money/pay/x");
    const expected = "Bearer " + createHmac("sha256", cfg.apiKey).update(capturedBody).digest("hex");
    expect(capturedAuth).toBe(expected);
    const parsed = JSON.parse(capturedBody);
    expect(parsed.nonce).toBe(1700000000);
    expect(parsed.shop_id).toBe(cfg.shopId);
    expect(parsed.order_id).toBe("test-order-1");
  });

  it("throws TegroApiError on non-success type", async () => {
    const c = new TegroClient(cfg, {
      fetch: mockFetch(() => ({ type: "error", desc: "invalid_signature" })),
    });
    await expect(c.createOrder({ currency: "RUB", amount: 1, orderId: "x" })).rejects.toBeInstanceOf(TegroApiError);
  });
});

describe("TegroClient.balance", () => {
  it("POSTs /balance/ with shop_id + nonce, returns balances", async () => {
    const c = new TegroClient(cfg, {
      nonce: () => 42,
      fetch: mockFetch((url) => {
        expect(url.endsWith("/balance/")).toBe(true);
        return {
          type: "success",
          desc: "",
          data: { user_id: 12345, balance: { RUB: "1234.56", USD: "0.00" } },
        };
      }),
    });
    const b = await c.balance();
    expect(b.user_id).toBe(12345);
    expect(b.balance.RUB).toBe("1234.56");
  });
});

describe("TegroClient.checkOrder", () => {
  it("requires order_id OR payment_id", async () => {
    const c = new TegroClient(cfg, { fetch: mockFetch(() => ({})) });
    await expect(c.checkOrder({})).rejects.toBeInstanceOf(TegroApiError);
  });

  it("looks up by payment_id and returns status", async () => {
    const c = new TegroClient(cfg, {
      fetch: mockFetch((url, init) => {
        expect(url.endsWith("/order/")).toBe(true);
        const body = JSON.parse(init.body as string);
        expect(body.payment_id).toBe("my-order-42");
        return {
          type: "success",
          desc: "",
          data: {
            id: 1232,
            date_created: "2026-05-13T18:00:00",
            date_payed: "2026-05-13T18:05:00",
            status: 1,
            payment_system_id: 5,
            currency_id: 1,
            amount: "64.18000000",
            fee: "1.92000000",
            email: "u@example.com",
            test_order: 0,
            payment_id: "my-order-42",
          },
        };
      }),
    });
    const o = await c.checkOrder({ payment_id: "my-order-42" });
    expect(o.status).toBe(1);
    expect(isOrderPaid(o)).toBe(true);
    expect(isOrderPending(o)).toBe(false);
  });
});

describe("TegroClient.listOrders", () => {
  it("wraps the array under {items}", async () => {
    const c = new TegroClient(cfg, {
      fetch: mockFetch((url) => {
        expect(url.endsWith("/orders/")).toBe(true);
        return {
          type: "success",
          desc: "",
          data: [
            { id: 1, status: 1, payment_id: "a", amount: "10.00", fee: "0.30", email: "", test_order: 0, payment_system_id: 5, currency_id: 1, date_created: "", date_payed: null },
            { id: 2, status: 0, payment_id: "b", amount: "20.00", fee: "0.60", email: "", test_order: 0, payment_system_id: 5, currency_id: 1, date_created: "", date_payed: null },
          ],
        };
      }),
    });
    const { items } = await c.listOrders({ page: 1 });
    expect(items).toHaveLength(2);
    expect(items.filter(isOrderPaid)).toHaveLength(1);
  });
});

describe("order-status helpers", () => {
  it("classifies all four documented statuses", () => {
    expect(isOrderPending({ status: 0 })).toBe(true);
    expect(isOrderPaid({ status: 1 })).toBe(true);
    expect(isOrderFailed({ status: 2 })).toBe(true);
    expect(isOrderRefunded({ status: 3 })).toBe(true);
  });
});
