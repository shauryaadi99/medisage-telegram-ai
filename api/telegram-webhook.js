// api/telegram-webhook.js
import "dotenv/config";
import { createBot } from "../botLogic.js";

const bot = createBot(); // same logic, no polling

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(200).send("OK");
    return;
  }

  const update = req.body;
  bot.processUpdate(update);
  res.status(200).send("OK");
}
