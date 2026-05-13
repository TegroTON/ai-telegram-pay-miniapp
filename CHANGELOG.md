# Changelog

## 0.1.0 — 2026-05-14

Initial release.

- `TegroClient.createOrder()` — POST `/api/createOrder/` with `Authorization: Bearer <HMAC-SHA256(body, API_KEY)>` and unique `nonce`.
- `verifyAndParseNotification()` — verifies webhook signature using `md5(ksort + http_build_query + SECRET_KEY)` with constant-time comparison.
- TypeScript types for all request/response shapes.
- Express webhook receiver example.
- End-to-end grammY bot example tying createOrder + webhook + Telegram notifications.
- Vitest suite that reproduces PHP reference signatures from official docs and verifies tampering rejection.

Signing schemes verified against `tegro.money/docs/en/` on 2026-05-14.
