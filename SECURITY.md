# Security Policy

Thank you for taking the time to look into the security of this package. We treat security reports as a first-class contribution.

## Supported versions

We follow [Semantic Versioning](https://semver.org/). Security fixes land on the **latest minor of the current major** and, where reasonable, on the previous major during its grace window.

| Version | Status |
| ------- | ------ |
| `0.2.x` | ✅ Active — security fixes land here. |
| `0.1.x` | ⚠️ Grace until 2026-08-01 — only critical fixes. |
| `< 0.1` | ❌ No support. Please upgrade. |

When `1.0.0` ships, the table is rewritten and grace windows reset.

## Reporting a vulnerability

**Please do not open public issues for security problems.**

Use **GitHub Private Vulnerability Reporting** instead:

1. Go to the [Security tab](https://github.com/TegroTON/ai-telegram-pay-miniapp/security/advisories/new) of this repository.
2. Click **Report a vulnerability**.
3. Fill in the form. Include reproduction steps and a proposed severity if you can — it speeds up triage.

The report stays private between you and the maintainers until a fix is published.

If GitHub is unreachable to you for any reason, you can fall back to reaching the maintainers via the contact details on the [TegroTON organization page](https://github.com/TegroTON).

## What we treat as in-scope

This repository ships **client-side library code** that produces signed HTTP requests and verifies webhook signatures. The threat model is roughly:

- A network attacker between the consumer and the upstream HTTP API.
- An attacker controlling the body of an inbound webhook.
- A supply-chain attacker tampering with the published `npm` artifact.

Examples of issues we want to hear about:

- Signature verification that accepts a tampered or replayed webhook.
- Timing side channels in signature comparison.
- Improper handling of nonces / order IDs that enables replay.
- Dependency vulnerabilities reachable from the published `dist/` output.
- Documentation that demonstrably leads a careful integrator into an insecure configuration.

## What is out of scope

- Vulnerabilities in the upstream payment processor service itself. Those should be reported to the operator of that service directly.
- Issues that require an attacker to already have write access to your bot's process environment, secrets store, or database. The package does not assume any of these are trustless.
- DoS by sending the library extremely large payloads. Consumers are expected to apply request-body limits at their HTTP layer.

## Response SLA

We aim for the following — best-effort, no contractual guarantee:

| Event | Target |
| --- | --- |
| Acknowledge receipt of a report | within 72 hours |
| Triage decision (in-scope / not) | within 7 days |
| Fix or mitigation for a confirmed issue | within 30 days for High/Critical |
| Public advisory + patched release | coordinated with reporter |

We will credit reporters in the published GitHub Security Advisory unless asked otherwise.

## Coordinated disclosure

We follow a coordinated-disclosure model. After a fix ships:

1. A GitHub Security Advisory is published with a CVE where applicable.
2. The CHANGELOG entry references the advisory ID.
3. The reporter is credited.

Please give us a reasonable window to fix before public disclosure. If you have a deadline (conference talk, blog post), tell us up front — we will work to meet it.
