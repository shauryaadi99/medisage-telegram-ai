import dotenv from 'dotenv';
dotenv.config();

import { createBot } from '../botLogic.js';

const bot = createBot();

export default async function handler(req, res) {
  try {
    console.log('📥 Telegram update received');
    
    // MANUAL WEBHOOK PROCESSING (v0.66.0 fix)
    const update = req.body;
    
    if (update.message) {
      await bot.processUpdate(update);
    } else if (update.callback_query) {
      await bot.processUpdate(update);
    }
    
    console.log('✅ Update processed');
    res.status(200).json({ status: 'ok' });
  } catch (e) {
    console.error('💥 Bot error:', e);
    res.status(500).json({ error: 'Bot processing failed', details: e.message });
  }
}
