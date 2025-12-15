import dotenv from 'dotenv';
dotenv.config();

import { createBot } from '../botLogic.js';

const bot = createBot();

export default async function handler(req, res) {
  try {
    // ✅ PASS RAW req.body DIRECTLY (botLogic.js handles it!)
    console.log('📥 Raw webhook:', req.body.update_id);
    await bot.processUpdate(req.body);  // ← RAW!
    res.status(200).json({ status: 'ok' });
  } catch (e) {
    console.error('💥 Error:', e.message);
    res.status(500).json({ error: 'Bot failed', details: e.message });
  }
}
