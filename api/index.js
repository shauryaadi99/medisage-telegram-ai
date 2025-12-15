import dotenv from 'dotenv';
dotenv.config();

import { createBot } from '../botLogic.js';

const bot = createBot();

export default async function handler(req, res) {
  try {
    console.log('📥 Telegram update:', JSON.stringify(req.body, null, 2));
    await bot.handleUpdate(req.body);
    console.log('✅ Bot processed successfully');
    res.status(200).json({ status: 'ok' });
  } catch (e) {
    console.error('💥 FULL ERROR:', e);
    console.error('💥 STACK:', e.stack);
    res.status(500).json({ error: 'Bot processing failed', details: e.message });
  }
}
