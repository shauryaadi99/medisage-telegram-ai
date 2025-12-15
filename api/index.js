import dotenv from 'dotenv';
dotenv.config();

import { createBot } from '../botLogic.js';

const bot = createBot();

export default async function handler(req, res) {
  try {
    const update = req.body;
    
    // ✅ YOUR createBot() handles EVERYTHING!
    if (update.message) {
      // Trigger YOUR botLogic.js message handlers
      bot.on('message', async (msg) => {
        // YOUR handlers already work: /start, /quickconsult, RAG, etc.
      });
      
      // Simulate message event for YOUR handlers
      bot.emit('message', update.message);
    }
    
    res.status(200).json({ status: 'ok' });
  } catch (e) {
    console.error('💥 Error:', e.message);
    res.status(500).json({ error: 'Bot failed', details: e.message });
  }
}
