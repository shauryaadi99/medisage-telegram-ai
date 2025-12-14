// api/telegram-webhook.js
require('dotenv').config();  // ← CHANGE: CommonJS for Vercel
const { createBot } = require('../botLogic.js');  // ← CHANGE: CommonJS

const bot = createBot(); // same logic, no polling

// CommonJS export for Vercel (not ES module)
module.exports = async (req, res) => {  // ← CHANGE: module.exports
  if (req.method !== "POST") {
    res.status(200).send("OK");
    return;
  }

  const update = req.body;
  await bot.processUpdate(update);  // ← ADD: await
  res.status(200).send("OK");
};
