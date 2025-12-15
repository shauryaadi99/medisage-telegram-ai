import dotenv from "dotenv";
dotenv.config();
import { describeImageEducational } from "../vision.js";
import fs from "fs";
import fetch from "node-fetch";
import path from "path";

import TelegramBot from "node-telegram-bot-api";
import {
  answerMedicalQuery,
  appendActions,
  handleGreetings,
  buildReportText,
  reportTextToStream,
} from "../botLogic.js";

const chatState = new Map();
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: false });

export default async function handler(req, res) {
  console.log("🚀 WEBHOOK HIT", new Date().toISOString());

  try {
    const update = req.body;
    if (!update?.message) return res.status(200).json({ status: "ok" });

    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text || "";
    console.log("📥", text || "photo");

    // 1. /start
    if (text === "/start") {
      await bot.sendMessage(
        chatId,
        `🩺 *Medisage AI* — Precision Medical Intelligence

Empowered by advanced medical references + vision AI

🔹 \`/quickconsult\`     Instant expert answers
🔹 \`/healthreport\`     Structured clinical report  
🔹 📸 *Medical images*  Visual symptom analysis

*Professional. Educational. Always safe.*

✍️ *Built by Shaurya Aditya Verma*
————————————`,
        { parse_mode: "Markdown" }
      );
      chatState.delete(chatId);
      return res.status(200).json({ status: "ok" });
    }

    // 2. /quickconsult
    if (text === "/quickconsult") {
      chatState.set(chatId, { mode: "quick" });
      await bot.sendMessage(
        chatId,
        `🩺 *Quick Consult* — Instant Medical Insights

Ask anything about symptoms, conditions, or concerns:

• "White patch on tongue, 3 days?"
• "Chest tightness after meals?" 
• "Child fever + rash pattern?"

*Powered by medical reference database* 🔍`,
        { parse_mode: "Markdown" }
      );

      return res.status(200).json({ status: "ok" });
    }

    // 3. /healthreport
    if (text === "/healthreport") {
      chatState.set(chatId, { mode: "report", step: "askName", form: {} });
      await bot.sendMessage(
        chatId,
        "📋 *Personalized Health Assessment*\n\n" +
          "Welcome to your custom medical report. Let's create something comprehensive.\n\n" +
          "✨ *Step 1:* Please share your full name.",
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

    // 🔥 5. PHOTO HANDLER
    if (msg.photo) {
      console.log("🖼️ PHOTO RECEIVED");
      try {
        const photo = msg.photo[msg.photo.length - 1];
        const fileId = photo.file_id;
        const file = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

        const localPath = `/tmp/photo-${chatId}.jpg`;
        const res = await fetch(fileUrl);
        const arrayBuffer = await res.arrayBuffer();
        fs.writeFileSync(localPath, Buffer.from(arrayBuffer));

        await bot.sendMessage(
          chatId,
          `🖼️ *Analyzing medical image...*
🔬 [Vision AI + medical reference cross-check]`
        );

        const description = await describeImageEducational(localPath);
        fs.unlinkSync(localPath);

        if (!description || description.includes("unavailable")) {
          await bot.sendMessage(
            chatId,
            "⚠️ Could not analyze image. Try text."
          );
          return res.status(200).json({ status: "ok" });
        }

        const query =
          "Image-based medical question. Image shows: " + description;
        const answer = await answerMedicalQuery(query);
        let reply = String(answer);
        if (reply.length > 4000)
          reply = reply.slice(0, 3950) + "\n\n…truncated…";
        reply = appendActions(reply);

        await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
      } catch (error) {
        console.error("💥 Photo error:", error.message);
        await bot.sendMessage(chatId, "⚠️ Image processing failed. Try text.");
      }
      return res.status(200).json({ status: "ok" });
    }

    // 6. Health Report Flow
    const state = chatState.get(chatId);
    if (state?.mode === "report") {
      const form = state.form;

      if (state.step === "askName") {
        form.name = text.trim();
        state.step = "askAge";
        chatState.set(chatId, state);

        await bot.sendMessage(
          chatId,
          `Thank you, *${form.name}*.\n\n` +
            "✨ *Step 2:* What is your age? (for example: 28 years)",
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
          "Describe your main problem and symptoms.",
          { parse_mode: "Markdown" }
        );
        return res.status(200).json({ status: "ok" });
      }

      if (state.step === "askProblem") {
        form.problem = text.trim();
        chatState.delete(chatId);

        await bot.sendMessage(chatId, "📑 Generating health report...", {
          parse_mode: "Markdown",
        });
        const combinedQuery = `Guided health report.\nName: ${form.name}\nAge: ${form.age}\nProblem: ${form.problem}\n\nStructured report with sections: Short Answer, Causes, Symptoms, Tests, Treatment, Self-Care, Red Flags, Disclaimer.`;

        const answer = await answerMedicalQuery(combinedQuery);
        const rawAnswer = String(answer);
        const reportText = buildReportText(rawAnswer, {
          name: form.name,
          age: form.age,
        });

        let reply = rawAnswer;
        if (reply.length > 4000)
          reply = reply.slice(0, 3950) + "\n\n…shortened…";
        reply = appendActions(reply);

        await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
        const reportStream = reportTextToStream(reportText);
        await bot.sendDocument(
          chatId,
          reportStream,
          {},
          { filename: "health-report.txt", contentType: "text/plain" }
        );
        await bot.sendMessage(
          chatId,
          `✅ *Report Complete!* 
Your personalized assessment has been delivered 📎

Ready for another question? Use \`/quickconsult\`
To start a fresh guided report, use \`/healthreport\`
To see all options again, use \`/start\``,
          { parse_mode: "Markdown" }
        );

        return res.status(200).json({ status: "ok" });
      }
    }

    // 7. Quick Consult / Default RAG
    if (!state || state.mode === "quick") {
      await bot.sendMessage(
        chatId,
        `🔬 *Analyzing with medical database...*
⏳ [Retrieving 5 most relevant references]`,
        { parse_mode: "Markdown" }
      );

      try {
        const answer = await answerMedicalQuery(text);
        let reply = String(answer);
        if (reply.length > 4000)
          reply = reply.slice(0, 3950) + "\n\n…shortened…";
        reply = appendActions(reply);
        await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
      } catch (error) {
        console.error("💥 RAG Error:", error.message);
        await bot.sendMessage(
          chatId,
          "*⚠️ Temporary error*\nPlease try again.",
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
