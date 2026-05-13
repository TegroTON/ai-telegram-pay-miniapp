// Standalone Express server that accepts Tegro.Money webhooks.
//
// Run: TEGRO_SECRET_KEY=... npx tsx examples/express-webhook.ts
//
// Then in your Tegro cabinet → Shop settings → set "Notification URL" to:
//   https://your-domain.example/tegro/webhook

import express from "express";
import { verifyAndParseNotification, WebhookSignatureError } from "../src/index.js";

const PORT = Number(process.env.PORT ?? 3000);
const SECRET = process.env.TEGRO_SECRET_KEY;
if (!SECRET) {
  console.error("Set TEGRO_SECRET_KEY in env");
  process.exit(1);
}

const app = express();
app.use(express.urlencoded({ extended: false })); // tegro sends form-data
app.use(express.json()); // some setups deliver JSON

app.post("/tegro/webhook", (req, res) => {
  try {
    const notification = verifyAndParseNotification(req.body as Record<string, string>, SECRET);
    if (notification.isTest) {
      console.log("test webhook received, not crediting:", notification.orderId);
      return res.json({ ok: true, test: true });
    }
    // ↓↓↓ Your business logic here ↓↓↓
    //   - Look up your internal order by notification.orderId
    //   - Credit the user's balance with notification.amountRub
    //   - Mark the order as paid
    console.log(`PAID order=${notification.orderId} amount=${notification.amountRub} RUB`);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      console.warn("webhook signature error:", err.code);
      return res.status(401).json({ error: err.code });
    }
    console.error(err);
    res.status(500).json({ error: "internal" });
  }
});

app.listen(PORT, () => {
  console.log(`Tegro webhook listening on :${PORT}/tegro/webhook`);
});
