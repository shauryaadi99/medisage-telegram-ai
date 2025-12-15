require('dotenv').config();
const { createBot } = require('../botLogic.cjs');

const bot = createBot();

module.exports = async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
    res.status(200).json({ status: 'ok' });
  } catch (e) {
    console.error('Vercel bot error:', e);
    res.status(500).json({ error: 'Bot processing failed' });
  }
};
