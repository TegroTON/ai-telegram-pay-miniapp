# Changelog

## 0.2.0 — 2026-05-14

Three more endpoints + status helpers.

- `TegroClient.balance()` — POST `/api/balance/`, returns multi-currency wallet (`RUB`, `USD`, `EUR`, `UAH`).
- `TegroClient.checkOrder({ order_id } | { payment_id })` — POST `/api/order/`, returns one order with `status`, `amount`, `date_payed`, fee.
- `TegroClient.listOrders({ page? })` — POST `/api/orders/`, paginated, wrapped as `{ items: OrderRecord[] }` so future fields (total / per_page) can be added without a breaking change.
- Status helpers: `isOrderPaid`, `isOrderPending`, `isOrderFailed`, `isOrderRefunded` — keeps the documented numeric `status` enum out of consumer code.
- Tests cover request shape, Bearer signature, error envelope, and the helpers.

No breaking changes. Same signing scheme as 0.1.0.

## 0.1.0 — 2026-05-14

Initial release.

- `TegroClient.createOrder()` — POST `/api/createOrder/` with `Authorization: Bearer <HMAC-SHA256(body, API_KEY)>` and unique `nonce`.
- `verifyAndParseNotification()` — verifies webhook signature using `md5(ksort + http_build_query + SECRET_KEY)` with constant-time comparison.
- TypeScript types for all request/response shapes.
- Express webhook receiver example.
- End-to-end grammY bot example tying createOrder + webhook + Telegram notifications.
- Vitest suite that reproduces PHP reference signatures from official docs and verifies tampering rejection.

Signing schemes verified against `tegro.money/docs/en/` on 2026-05-14.
