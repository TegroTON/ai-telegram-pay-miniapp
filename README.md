# @tegroton/tegro-money

[![npm](https://img.shields.io/npm/v/@tegroton/tegro-money.svg)](https://www.npmjs.com/package/@tegroton/tegro-money)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Production-ready Tegro.Money integration for Telegram bots. Two helpers, zero magic:

- `TegroClient.createOrder()` — signs and POSTs `/api/createOrder/`, returns the hosted payment URL.
- `verifyAndParseNotification()` — constant-time-verifies an incoming webhook, returns the parsed fields.

Plus a working **grammY bot** example that ties them together end-to-end.

> **Status:** verified against the official spec at `tegro.money/docs/en/` on 2026-05-14.
> Used in production by [Libermall Card](https://card.libermall.com).

---

## Why this exists

Tegro.Money is one of the few Russian-friendly fiat acquirers that accepts cards / СБП / e-wallets for nerd-budget projects. Their docs are good, but every dev that ships a Telegram bot ends up writing the same 80 lines of HMAC + MD5 plumbing. This package is that plumbing — extracted, tested, MIT-licensed.

## Install

```bash
npm install @tegroton/tegro-money
# or
pnpm add @tegroton/tegro-money
```

Node.js ≥ 18 required (uses built-in `crypto.timingSafeEqual` and global `fetch`).

## Quick start

### 1. Get your credentials

In your Tegro.Money cabinet → **Магазины** → выбрать магазин → **Настройки**:

| What you need | Where it lives |
|---|---|
| `shop_id` | "ID магазина" |
| `api_key` | "API-ключ" — used to **sign outgoing requests** |
| `secret_key` | "Секретный ключ" — used to **verify incoming webhooks** |

Then in the same screen set **"URL уведомлений"** (notification URL) to your webhook endpoint (see step 3).

### 2. Create an order

```ts
import { TegroClient } from "@tegroton/tegro-money";

const tegro = new TegroClient({
  shopId:    process.env.TEGRO_SHOP_ID!,
  apiKey:    process.env.TEGRO_API_KEY!,
  secretKey: process.env.TEGRO_SECRET_KEY!,
});

const { id, url } = await tegro.createOrder({
  currency: "RUB",
  amount: 100,
  orderId: "my-internal-id-12345",
  fields: { email: "user@example.com" },
  receipt: { items: [{ name: "Top-up", count: 1, price: 100 }] },
});

// Redirect the user to `url` — they'll pay on tegro.money's hosted page.
```

### 3. Verify the webhook

```ts
import express from "express";
import { verifyAndParseNotification, WebhookSignatureError } from "@tegroton/tegro-money";

const app = express();
app.use(express.urlencoded({ extended: false })); // tegro sends form-data

app.post("/tegro/webhook", (req, res) => {
  try {
    const n = verifyAndParseNotification(req.body, process.env.TEGRO_SECRET_KEY!);
    if (n.isTest) return res.json({ ok: true, test: true });

    // n.orderId === the orderId you passed to createOrder()
    // n.amountRub === paid amount
    // → credit the user, mark the order as paid
    creditUser(n.orderId, n.amountRub);

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      return res.status(401).json({ error: err.code });
    }
    throw err;
  }
});

app.listen(3000);
```

### 4. Wire it to a Telegram bot

See [`examples/minimal-bot.ts`](examples/minimal-bot.ts) for a full grammY bot:

```
User → /pay 100
Bot  → tegro.createOrder({ amount: 100, orderId: `<user>-<ts>` })
Bot  → "Pay here: https://tegro.money/pay/..."
User → pays
Tegro → POST /tegro/webhook { order_id, amount, sign }
Bot  → verifyAndParseNotification(...) → sendMessage(user, "✅ paid")
```

Run it:

```bash
TEGRO_SHOP_ID=... \
TEGRO_API_KEY=... \
TEGRO_SECRET_KEY=... \
BOT_TOKEN=... \
npx tsx examples/minimal-bot.ts
```

---

## How signing works (so you can debug it)

### Outgoing requests (createOrder, balance, withdraw, …)

```
Authorization: Bearer  <HMAC-SHA256(rawJsonBody, API_KEY)>   // hex, lowercase
```

The `nonce` field in the body MUST be unique per request — this package uses `Date.now()`. Tegro rejects replays.

### Incoming webhooks

```
1. take every field EXCEPT `sign`
2. sort keys alphabetically
3. build URL-encoded query: a=1&b=2&c=3
4. expected = md5(query + SECRET_KEY)   // lowercase hex
5. compare to body.sign
```

Important gotchas verified against the docs page:

- `amount` is a **string** in the webhook ("`100.00`", not `100`). Don't coerce to a number before signing.
- The signed query uses **standard `application/x-www-form-urlencoded`** rules (space → `+`, etc.), matching PHP's `http_build_query`.
- The comparison is **constant-time** via `crypto.timingSafeEqual` — don't replace it with `===`.

### Test mode

When a test notification arrives, the field `test=1` is included in the payload AND in the signature. The package surfaces it as `isTest: true` on the parsed result — credit nothing, return 200.

---

## API reference

### `new TegroClient(config, options?)`

```ts
type TegroConfig = {
  shopId:    string;
  apiKey:    string;
  secretKey: string;
};

type TegroClientOptions = {
  apiBase?: string;              // default "https://tegro.money/api"
  nonce?: () => number;          // default () => Date.now()
  fetch?: typeof fetch;          // inject for tests
};
```

### `client.createOrder(req): Promise<{ id, url }>`

```ts
type CreateOrderRequest = {
  currency: "RUB" | "USD" | "EUR";
  amount: number;
  orderId: string;
  paymentSystem?: number;
  fields?: { email?: string; phone?: string };
  receipt?: { items: { name: string; count: number; price: number }[] };
};
```

Throws `TegroApiError` if Tegro returns `type !== "success"` or HTTP 4xx/5xx.

### `client.balance(): Promise<BalanceResponse>`

Returns the merchant's multi-currency wallet:

```ts
type BalanceResponse = {
  user_id: number;
  balance: { RUB?: string; USD?: string; EUR?: string; UAH?: string };
};
```

Amounts are decimal strings — don't coerce to `number` if you care about accounting precision.

### `client.checkOrder({ order_id } | { payment_id }): Promise<OrderRecord>`

Look up one order. Pass either Tegro's `order_id` or your own `payment_id` (the value you used when calling `createOrder`).

```ts
type OrderRecord = {
  id: number;
  date_created: string;
  date_payed: string | null;
  status: number;          // 0=new 1=paid 2=failed 3=refunded
  payment_system_id: number;
  currency_id: number;
  amount: string;
  fee: string;
  email: string;
  test_order: 0 | 1;
  payment_id: string;
};
```

Use the helpers to avoid magic numbers:

```ts
import { isOrderPaid, isOrderPending, isOrderFailed, isOrderRefunded } from "@tegroton/tegro-money";

const o = await client.checkOrder({ payment_id: "my-order-42" });
if (isOrderPaid(o)) creditUser(o.payment_id, Number(o.amount));
```

### `client.listOrders({ page? }): Promise<{ items: OrderRecord[] }>`

Paginated list of recent orders (page defaults to 1, server-side page size).

### `verifyAndParseNotification(rawFields, secretKey): VerifiedNotification`

```ts
type VerifiedNotification = {
  shopId: string;
  amountRub: number;
  orderId: string;
  paymentSystem: string;
  currency: string;
  paymentId: string | null;
  isTest: boolean;
};
```

Throws `WebhookSignatureError` with `.code` in: `missing_sign`, `bad_signature`, `missing_required_fields`, `bad_amount`.

### `signRequestBody(jsonBody, apiKey): string`

Low-level helper if you want to skip `TegroClient` (e.g. for batch / streaming requests).

---

## Tests

```bash
npm test
```

Tests reproduce the PHP reference implementations from the docs verbatim and verify cross-compatibility (Node ↔ PHP ↔ Python).

---

## Roadmap / non-goals

✅ Implemented
- HMAC-SHA256 request signing
- MD5 webhook verification (constant-time)
- TypeScript types for all endpoints
- Endpoints: `createOrder`, `balance`, `checkOrder`, `listOrders`
- Status helpers (`isOrderPaid`, `isOrderPending`, ...)
- Test-mode handling
- grammY bot example

🚧 Not yet (PRs welcome)
- `createWithdrawal` (payouts)
- `listShops` / `rates`
- Sandbox mode
- Webhook retry/dead-letter helper

❌ Out of scope
- This package does **not** manage a database. Bring your own.
- It does **not** poll for status — webhook-only.
- It does **not** handle FX. If you need to convert RUB → USD/USDT, plug in your own rate source.

---

## Why MIT

Because the alternative is everyone writing their own buggy MD5 logic. Take the code, ship your project. Acknowledgement nice but not required.

PRs welcome at [github.com/DeFiTON/@tegroton/tegro-money](https://github.com/DeFiTON/@tegroton/tegro-money).

---

## See also

- [Tegro.Money official docs](https://tegro.money/docs/en/) — authoritative source for endpoint behaviour.
- [grammY](https://grammy.dev/) — modern Telegram bot framework used in the example.
- [Libermall Card](https://card.libermall.com) — reference production deployment.
