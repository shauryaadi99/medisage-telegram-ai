import dotenv from 'dotenv';
dotenv.config();

import { createBot } from '../botLogic.js';

const bot = createBot();  // Your perfect bot!

export default async function handler(req, res) {
  try {
    const update = req.body;
    
    if (!update?.message) return res.status(200).json({ status: 'ok' });
    
    console.log('📥', update.message.text);
    
    // ✅ YOUR createBot() handles EVERYTHING!
    bot.emit('message', update.message);  // Triggers YOUR onText/on("message")
    
    res.status(200).json({ status: 'ok' });
  } catch (e) {
    console.error('💥', e.message);
    res.status(500).json({ error: 'Bot failed', details: e.message });
  }
}
