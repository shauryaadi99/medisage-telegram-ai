import dotenv from 'dotenv';
dotenv.config();

import TelegramBot from 'node-telegram-bot-api';
import { createBot } from '../botLogic.js';

const bot = createBot();

export default async function handler(req, res) {
  try {
    console.log('📥 Raw update:', JSON.stringify(req.body, null, 2));
    
    // ✅ FORMAT FOR node-telegram-bot-api
    const update = {
      update_id: req.body.update_id,
      message: req.body.message,
      callback_query: req.body.callback_query,
      // Add other update types if needed
    };
    
    await bot.processUpdate(update);
    console.log('✅ Processed');
    res.status(200).json({ status: 'ok' });
  } catch (e) {
    console.error('💥 Bot error:', e);
    res.status(500).json({ error: 'Bot processing failed', details: e.message });
  }
}
