import dotenv from 'dotenv';
dotenv.config();

import { createBot } from '../botLogic.js';

const bot = createBot();

export default async function handler(req, res) {
  try {
    const update = req.body;
    
    // ✅ NULL CHECK FIRST!
    if (!update || !update.message) {
      console.log('📥 No message in update:', update);
      return res.status(200).json({ status: 'ok' });
    }
    
    console.log('📥 Message received:', update.message.text);
    
    // ✅ YOUR createBot() handlers triggered!
    bot.emit('message', update.message);
    
    res.status(200).json({ status: 'ok' });
  } catch (e) {
    console.error('💥 Error:', e.message);
    res.status(500).json({ error: 'Bot failed', details: e.message });
  }
}
