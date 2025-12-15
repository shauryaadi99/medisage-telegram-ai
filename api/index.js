import dotenv from 'dotenv';
dotenv.config();

import { createBot } from '../botLogic.js';

let bot; // Single instance!

// Initialize ONCE
if (!bot) {
  bot = createBot();
}

export default async function handler(req, res) {
  try {
    const update = req.body;
    console.log('📥', update.message?.text || 'non-text');
    
    // ✅ OFFICIAL node-telegram-bot-api webhook method!
    await bot.processUpdate(update);
    
    res.status(200).json({ status: 'ok' });
  } catch (e) {
    console.error('💥', e.message);
    res.status(500).json({ error: 'Bot failed', details: e.message });
  }
}
