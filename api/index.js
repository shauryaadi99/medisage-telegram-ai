import dotenv from 'dotenv';
dotenv.config();

import { createBot } from '../botLogic.js';

const bot = createBot();

export default async function handler(req, res) {
  try {
    // MANUAL MESSAGE HANDLING (bypasses processUpdate)
    const update = req.body;
    console.log('📥 Update ID:', update?.update_id);
    
    if (update?.message) {
      const msg = update.message;  // ← EXTRACT msg for botLogic.js
      await bot.emit('message', msg);
    }
    
    res.status(200).json({ status: 'ok' });
  } catch (e) {
    console.error('💥 Error:', e.message);
    res.status(500).json({ error: 'Bot failed', details: e.message });
  }
}
