// api/index.js - ES MODULE VERSION
import dotenv from 'dotenv';
dotenv.config();

import { createBot } from '../botLogic.js';  // ← .js (ES module)

const bot = createBot();

export default async function handler(req, res) {
  try {
    await bot.handleUpdate(req.body);
    res.status(200).json({ status: 'ok' });
  } catch (e) {
    console.error('Vercel bot error:', e);
    res.status(500).json({ error: 'Bot processing failed' });
  }
}
