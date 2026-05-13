// Minimal Telegram bot that accepts RUB payments via Tegro.Money.
//
// User flow:
//   1. /start  →  bot greets, explains
//   2. /pay 100  →  bot creates a Tegro order and sends the payment URL
//   3. User pays on tegro.money's hosted page
//   4. Tegro POSTs a webhook to /tegro/webhook
//   5. Bot notifies the user "paid!" via Telegram
//
// This file glues grammY (for the bot) + Express (for the webhook).
// Run: TEGRO_SHOP_ID=... TEGRO_API_KEY=... TEGRO_SECRET_KEY=... BOT_TOKEN=... npx tsx examples/minimal-bot.ts

import express from "express";
import { Bot } from "grammy";
import { TegroClient, verifyAndParseNotification, WebhookSignatureError } from "../src/index.js";

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};

const tegro = new TegroClient({
  shopId: env("TEGRO_SHOP_ID"),
  apiKey: env("TEGRO_API_KEY"),
  secretKey: env("TEGRO_SECRET_KEY"),
});
const bot = new Bot(env("BOT_TOKEN"));

// In-memory order → user mapping. Replace with a database in production.
const orderToUser = new Map<string, number>();

bot.command("start", (ctx) =>
  ctx.reply(
    "Привет! Я принимаю оплату через Tegro.Money. Отправь /pay <сумма> чтобы получить ссылку на оплату.",
  ),
);

bot.command("pay", async (ctx) => {
  const amount = Number((ctx.match || "").trim());
  if (!Number.isFinite(amount) || amount <= 0) {
    return ctx.reply("Использование: /pay 100");
  }
  const orderId = `${ctx.from!.id}-${Date.now()}`;
  try {
    const { url } = await tegro.createOrder({
      currency: "RUB",
      amount,
      orderId,
      fields: { email: `tg-${ctx.from!.id}@example.com` },
      receipt: { items: [{ name: "Top-up", count: 1, price: amount }] },
    });
    orderToUser.set(orderId, ctx.from!.id);
    await ctx.reply(`Оплати ${amount} ₽ по ссылке:\n${url}`);
  } catch (err) {
    console.error("createOrder failed:", err);
    await ctx.reply("Не удалось создать счёт. Попробуй позже.");
  }
});

// Express webhook
const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.post("/tegro/webhook", async (req, res) => {
  try {
    const n = verifyAndParseNotification(req.body as Record<string, string>, env("TEGRO_SECRET_KEY"));
    if (n.isTest) return res.json({ ok: true, test: true });

    const userId = orderToUser.get(n.orderId);
    if (userId) {
      await bot.api.sendMessage(userId, `✅ Платёж получен: ${n.amountRub} ₽ за заказ ${n.orderId}`);
      orderToUser.delete(n.orderId);
    } else {
      console.warn("payment for unknown order:", n.orderId);
    }
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      return res.status(401).json({ error: err.code });
    }
    console.error(err);
    res.status(500).json({ error: "internal" });
  }
});

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => console.log(`webhook on :${PORT}`));
bot.start();
console.log("Bot started. Send /pay 100 in Telegram.");
