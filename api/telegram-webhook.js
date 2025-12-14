// api/telegram-webhook.js
require('dotenv').config();
const { createBot } = require('../botLogic.cjs');  // .cjs extension

const bot = createBot();

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(200).send("OK");
    return;
  }
  await bot.processUpdate(req.body);
  res.status(200).send("OK");
};
