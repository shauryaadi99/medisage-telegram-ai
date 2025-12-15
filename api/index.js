import dotenv from "dotenv";
dotenv.config();
// import { describeImageEducational } from "../vision.js"; // ADD THIS
import { describeImageEducational } from '../vision.js';  // ← ADD THIS
import fs from 'fs';  // ← ADD THIS  
import fetch from 'node-fetch';  // ← ADD THIS
import path from 'path';  // ← ADD THIS (for /tmp paths)

import TelegramBot from "node-telegram-bot-api";
import {
  answerMedicalQuery,
  appendActions,
  handleGreetings,
  buildReportText,
  reportTextToStream,
} from "../botLogic.js";

// GLOBAL STATE (shared across Vercel invocations)
const chatState = new Map();
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: false });

export default async function handler(req, res) {
  try {
    const update = req.body;
    if (!update?.message) return res.status(200).json({ status: "ok" });

    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text || ""; // ✅ Safe fallback

    console.log("📥", text || "photo");

    // 1. /start
    if (text === "/start") {
      await bot.sendMessage(
        chatId,
        "🩺 *Medisage AI Doctor* — Your Smart Medical Companion\n\n" +
          "1️⃣ */quickconsult* – Quick question, fast educational answer.\n" +
          "2️⃣ */healthreport* – Full guided health report with structured output.\n\n" +
          "You can also send a medical image any time!\n\n" +
          "👨‍💻 *Created by Shaurya Aditya Verma*",
        { parse_mode: "Markdown" }
      );
      chatState.delete(chatId); // Reset state
      return res.status(200).json({ status: "ok" });
    }

    // 2. /quickconsult
    if (text === "/quickconsult") {
      chatState.set(chatId, { mode: "quick" });
      await bot.sendMessage(
        chatId,
        "🩺 *Quick Consult*\n\nSend your health question as a normal text message.\n\n" +
          "Examples:\n• `Is this kind of mouth ulcer serious?`\n• `I have a mild headache for 2 days, should I worry?`",
        { parse_mode: "Markdown" }
      );
      return res.status(200).json({ status: "ok" });
    }

    // 3. /healthreport
    if (text === "/healthreport") {
      chatState.set(chatId, { mode: "report", step: "askName", form: {} });
      await bot.sendMessage(
        chatId,
        "📄 *Guided Health Report*\n\nI'll ask a few questions to create a structured, doctor-style report.\n\nFirst, please tell me your *name*.",
        { parse_mode: "Markdown" }
      );
      return res.status(200).json({ status: "ok" });
    }

  // 4. Greetings
const greeting = handleGreetings(text);
if (greeting) {
  await bot.sendMessage(chatId, greeting, { parse_mode: "Markdown" });
  return res.status(200).json({ status: "ok" });
}

// 🔥 5. PHOTO HANDLER (CORRECT SINGLE BLOCK)
if (msg.photo) {
  console.log('🖼️ PHOTO RECEIVED');
  try {
    const photo = msg.photo[msg.photo.length - 1];
    const fileId = photo.file_id;
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    
    const localPath = `/tmp/photo-${chatId}.jpg`;
    const res = await fetch(fileUrl);
    const arrayBuffer = await res.arrayBuffer();
    fs.writeFileSync(localPath, Buffer.from(arrayBuffer));
    
    await bot.sendMessage(chatId, "🖼️ Analyzing medical image...");
    
    const description = await describeImageEducational(localPath);
    fs.unlinkSync(localPath);
    
    if (!description || description.includes("unavailable")) {
      await bot.sendMessage(chatId, "⚠️ Could not analyze image. Try text.");
      return res.status(200).json({ status: 'ok' });
    }
    
    const query = "Image-based medical question. Image shows: " + description;
    const answer = await answerMedicalQuery(query);
    let reply = String(answer);
    if (reply.length > 4000) reply = reply.slice(0, 3950) + "\n\n…truncated…";
    reply = appendActions(reply);
    
    await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
  } catch (error) {
    console.error('💥 Photo error:', error.message);
    await bot.sendMessage(chatId, "⚠️ Image processing failed. Try text.");
  }
  return res.status(200).json({ status: 'ok' });
}

// 6. Health Report Flow (next)...




        // RAG with image description
        const query =
          "Image-based medical question. Image shows: " + description;
        const answer = await answerMedicalQuery(query);
        let reply = String(answer);
        if (reply.length > 4000) reply = reply.slice(0, 3950) + "...";
        reply = appendActions(reply);

        await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
      } catch (error) {
        console.error("💥 Photo error:", error);
        await bot.sendMessage(
          chatId,
          "⚠️ Image processing failed. Try text description."
        );
      }
      return res.status(200).json({ status: "ok" });
    }

    // 5. Health Report Flow (YOUR EXACT LOGIC)
    const state = chatState.get(chatId);
    if (state?.mode === "report") {
      const form = state.form;

      if (state.step === "askName") {
        form.name = text.trim();
        state.step = "askAge";
        chatState.set(chatId, state);
        await bot.sendMessage(
          chatId,
          `Thanks, *${form.name}*.\nNow please tell me your *age* (in years).`,
          { parse_mode: "Markdown" }
        );
        return res.status(200).json({ status: "ok" });
      }

      if (state.step === "askAge") {
        form.age = text.trim();
        state.step = "askProblem";
        chatState.set(chatId, state);
        await bot.sendMessage(
          chatId,
          "Got it.\nNow describe your main problem and symptoms in your own words.",
          { parse_mode: "Markdown" }
        );
        return res.status(200).json({ status: "ok" });
      }

      if (state.step === "askProblem") {
        form.problem = text.trim();
        chatState.delete(chatId);

        await bot.sendMessage(
          chatId,
          "📑 Generating your structured health report...",
          { parse_mode: "Markdown" }
        );

        const combinedQuery = `Guided health report for patient.\nName: ${form.name}\nAge: ${form.age}\nMain complaint: ${form.problem}\n\nWrite a structured report with sections: Short Direct Answer, Possible Causes, Typical Symptoms, Evaluation / Tests, Treatment Options, Self-Care and Lifestyle, Red Flags, Final Disclaimer.`;

        const answer = await answerMedicalQuery(combinedQuery);
        const rawAnswer = String(answer);
        const reportText = buildReportText(rawAnswer, {
          name: form.name,
          age: form.age,
        });

        let reply = rawAnswer;
        if (reply.length > 4000)
          reply = reply.slice(0, 3950) + "\n\n…report shortened…";
        reply = appendActions(reply);

        await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });

        // Send report file
        const reportStream = reportTextToStream(reportText);
        await bot.sendDocument(
          chatId,
          reportStream,
          {},
          {
            filename: "health-report.txt",
            contentType: "text/plain",
          }
        );

        await bot.sendMessage(
          chatId,
          "✅ Your guided health report is complete!\n\nUse /quickconsult for another question.",
          { parse_mode: "Markdown" }
        );
        return res.status(200).json({ status: "ok" });
      }
    }

    // 6. Quick Consult / Default RAG (YOUR MAGIC!)
    if (!state || state.mode === "quick") {
      await bot.sendMessage(
        chatId,
        "*🔍 Quick Consult*\n_Analyzing your question in the medical reference..._",
        { parse_mode: "Markdown" }
      );

      try {
        const answer = await answerMedicalQuery(text);
        let reply = String(answer);
        if (reply.length > 4000)
          reply = reply.slice(0, 3950) + "\n\n…answer shortened…";
        reply = appendActions(reply);
        await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
      } catch (error) {
        console.error("💥 RAG Error:", error.message);
        await bot.sendMessage(
          chatId,
          "*⚠️ Temporary error*\n\nSomething went wrong while searching the medical database.\nPlease try again.",
          { parse_mode: "Markdown" }
        );
      }
    }

    res.status(200).json({ status: "ok" });
  } catch (e) {
    console.error("💥", e.message);
    res.status(500).json({ error: "Bot failed", details: e.message });
  }
}
