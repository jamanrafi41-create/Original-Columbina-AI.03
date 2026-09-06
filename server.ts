import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { orchestrator } from "./server/orchestrator";
import { healthManager } from "./server/health";
import { gitHubProvider } from "./server/providers/github";
import { geminiLiveProvider } from "./server/providers/geminiLive";
import { groqProvider } from "./server/providers/groq";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// Lazy initialization for OpenAI
let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is missing.");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// Lazy initialization for Gemini
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Production-Grade System Health & Multi-Provider Status Check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    primaryBrain: "gemini",
    time: new Date().toISOString(),
    providers: healthManager.getSafeStatusSummary(),
  });
});

// Safe Multi-Provider Discovery & Capabilities Reporting (Zero Secret Leaks)
app.get("/api/providers", (_req, res) => {
  const providerList = orchestrator.getAllProviders().map((p) => {
    const record = healthManager.getRecord(p.id);
    return {
      id: p.id,
      name: p.name,
      configured: p.isConfigured(),
      available: p.isAvailable(),
      status: record?.status || "unconfigured",
      capabilities: p.capabilities,
      avgLatencyMs: record?.averageLatencyMs,
    };
  });

  res.json({
    primaryBrain: "gemini",
    providers: providerList,
  });
});

// Secure Server-Side GitHub Repository Inspection API
app.post("/api/github/inspect", async (req, res) => {
  try {
    const {
      owner = "jamanrafi41-create",
      repo = "my-ai-model0.2",
      path: reqPath = "",
      action = "info",
    } = req.body;

    if (!gitHubProvider.isConfigured()) {
      return res.status(403).json({
        error: "GITHUB_TOKEN is not configured in server environment.",
      });
    }

    if (action === "info") {
      const info = await gitHubProvider.getRepo(owner, repo);
      return res.json(info);
    } else if (action === "structure") {
      const structure = await gitHubProvider.getStructure(owner, repo, reqPath);
      return res.json(structure);
    } else if (action === "file") {
      const content = await gitHubProvider.getFileContent(owner, repo, reqPath);
      return res.json({ path: reqPath, content });
    } else if (action === "commits") {
      const commits = await gitHubProvider.getCommits(owner, repo);
      return res.json(commits);
    } else if (action === "issues") {
      const issues = await gitHubProvider.getIssues(owner, repo);
      return res.json(issues);
    } else if (action === "prs") {
      const prs = await gitHubProvider.getPullRequests(owner, repo);
      return res.json(prs);
    }

    return res.status(400).json({ error: `Unsupported action: ${action}` });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || "Failed to execute GitHub inspection query",
    });
  }
});

// Secure Ephemeral Session Creation for Gemini Live (Protects Secrets from Browser)
app.post("/api/live/session", (_req, res) => {
  try {
    if (!geminiLiveProvider.isConfigured()) {
      return res.status(503).json({
        error:
          "Gemini Live is not configured. Configure GEMINI_LIVE_API_KEY or GEMINI_API_KEY.",
      });
    }
    const session = geminiLiveProvider.createSession();
    return res.json(session);
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || "Failed to initialize Gemini Live session",
    });
  }
});

// Proxy for the VRM 3D model to guarantee bypass of CORS restrictions
app.get("/api/model-proxy", async (req, res) => {
  const targetUrl = (req.query.url as string) || "https://files.catbox.moe/r6x4ad.vrm";
  
  // Fast path: if requesting default model and cached locally, serve immediately
  const localModelPath = path.join(process.cwd(), "public", "model.vrm");
  if ((!req.query.url || req.query.url === "https://files.catbox.moe/r6x4ad.vrm") && fs.existsSync(localModelPath)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "model/gltf-binary");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.sendFile(localModelPath);
  }

  try {
    const fetchResponse = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });

    if (!fetchResponse.ok) {
      return res.status(fetchResponse.status).json({
        error: `Failed to fetch VRM model: ${fetchResponse.statusText}`,
      });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "model/gltf-binary");
    res.setHeader("Cache-Control", "public, max-age=86400");

    const arrayBuffer = await fetchResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error proxying VRM model:", error);
    res.status(500).json({ error: error.message || "Failed to proxy VRM file" });
  }
});

const ALLOWED_EMOTIONS = [
  // Fish Audio Core Emotions:
  "gentle",
  "friendly",
  "professional",
  "serious",
  "cheerful",
  "enthusiastic",
  "confident",
  "authoritative",
  "empathetic",
  "playful",
  "dramatic",
  "intimate",
  "mysterious",
  "sad",
  "angry",
  "sexy",
  // Standard & Character Emotions:
  "neutral",
  "happy",
  "excited",
  "surprised",
  "shy",
  "curious",
  "calm",
  "worried",
  "sleepy",
  "thinking",
  "relaxed",
  "wink",
] as const;

const ALLOWED_ANIMATIONS = [
  "idle",
  "talking",
  "happy",
  "sad",
  "surprised",
  "thinking",
  "excited",
  "sleepy",
] as const;

type AllowedEmotion = (typeof ALLOWED_EMOTIONS)[number];
type AllowedAnimation = (typeof ALLOWED_ANIMATIONS)[number];

interface StructuredAIResult {
  message: string;
  emotion: AllowedEmotion;
  intensity: number;
  expression?: string;
  voice_direction?: string;
  animation: AllowedAnimation;
}

// Conversational Chat API powered by OpenAI as the Primary AI Brain
type ColumbinaLanguage = "English" | "Hindi" | "Bengali" | "Japanese";

function detectLanguageSwitch(text: string): ColumbinaLanguage | null {
  if (!text || typeof text !== "string") return null;
  const t = text.trim();
  const lower = t.toLowerCase();

  // Bengali triggers
  if (
    /বাংলা|বাংলায়|বাঙলা|বাঙলায়/.test(t) ||
    /\b(speak|talk|switch\s*(to)?|change\s*(to)?|say\s*it\s*in)\s*(in\s*)?(bengali|bangla)\b/i.test(lower) ||
    /\b(in\s+bengali|in\s+bangla|bengali\s+please|bangla\s+please|start\s+bengali)\b/i.test(lower) ||
    /\bcan\s+you\s+speak\s+(bengali|bangla)\b/i.test(lower)
  ) {
    return "Bengali";
  }

  // Hindi triggers
  if (
    /हिंदी|हिन्दी/.test(t) ||
    /\b(speak|talk|switch\s*(to)?|change\s*(to)?|say\s*it\s*in)\s*(in\s*)?(hindi)\b/i.test(lower) ||
    /\b(in\s+hindi|hindi\s+please|hindi\s+me|hindi\s+mein|start\s+hindi)\b/i.test(lower) ||
    /\bcan\s+you\s+speak\s+hindi\b/i.test(lower)
  ) {
    return "Hindi";
  }

  // Japanese triggers
  if (
    /日本語|にほんご/.test(t) ||
    /\b(speak|talk|switch\s*(to)?|change\s*(to)?|say\s*it\s*in)\s*(in\s*)?(japanese|nihongo)\b/i.test(lower) ||
    /\b(in\s+japanese|japanese\s+please|nihongo\s+de|start\s+japanese)\b/i.test(lower) ||
    /\bcan\s+you\s+speak\s+japanese\b/i.test(lower)
  ) {
    return "Japanese";
  }

  // English triggers
  if (
    /ইংরেজিতে|ইংরেজি|अंग्रेजी|अंग्रेज़ी|英語/.test(t) ||
    /\b(speak|talk|switch\s*(to)?|change\s*(to)?|back\s*to)\s*(in\s*)?english\b/i.test(lower) ||
    /\b(in\s+english|english\s+please|english\s+again|talk\s+in\s+english|switch\s+back\s+to\s+english)\b/i.test(lower) ||
    /\bcan\s+you\s+speak\s+english\b/i.test(lower)
  ) {
    return "English";
  }

  return null;
}

app.post(["/api/chat", "/api/chat/stream"], async (req, res) => {
  let activeLanguage: ColumbinaLanguage = "English";
  try {
    const {
      messages,
      aiBrain = "auto",
      personality = "ethereal",
      memory,
      voiceAnalysis,
      currentLanguage = "English",
      stream = false,
    } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing or invalid messages array" });
    }

    const lastUserMsgObj = [...messages].reverse().find((m: any) => m.role === "user");
    const lastUserText = lastUserMsgObj ? (lastUserMsgObj.cleanText || lastUserMsgObj.content || "") : "";
    const detectedSwitch = detectLanguageSwitch(lastUserText);
    const validLanguages: ColumbinaLanguage[] = ["English", "Hindi", "Bengali", "Japanese"];
    activeLanguage = detectedSwitch || (validLanguages.includes(currentLanguage as ColumbinaLanguage) ? currentLanguage as ColumbinaLanguage : "English");

    const isStreamRequested =
      stream === true ||
      req.path.endsWith("/stream") ||
      req.headers.accept === "text/event-stream";

    if (isStreamRequested) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      try {
        const result = await orchestrator.executeChat({
          messages,
          aiBrain,
          personality,
          memory,
          voiceAnalysis: voiceAnalysis || lastUserMsgObj?.voiceAnalysis,
          currentLanguage: activeLanguage,
        });

        // Stream word chunks for natural smooth typewriter rendering
        const words = result.cleanText.split(/(\s+)/);
        for (let i = 0; i < words.length; i += 2) {
          const chunk = (words[i] || "") + (words[i + 1] || "");
          res.write(`data: ${JSON.stringify({ type: "chunk", chunk })}\n\n`);
        }

        res.write(
          `data: ${JSON.stringify({
            type: "done",
            message: result.cleanText,
            cleanText: result.cleanText,
            text: result.cleanText,
            emotion: result.emotion,
            intensity: result.intensity,
            userEmotion: result.userEmotion,
            voiceStyle: result.voiceStyle,
            voiceSpeed: result.voiceSpeed,
            voicePitch: result.voicePitch,
            facialExpression: result.facialExpression,
            action: result.action,
            gesture: result.gesture,
            expression: result.expression,
            voice_direction: result.voice_direction,
            animation: result.animation,
            currentLanguage: result.currentLanguage,
            brain: result.diagnostic.selectedProvider,
            diagnostic: result.diagnostic,
          })}\n\n`
        );
        return res.end();
      } catch (streamErr: any) {
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            error: streamErr?.message || "Streaming error",
          })}\n\n`
        );
        return res.end();
      }
    }

    // Standard non-streaming JSON response
    const result = await orchestrator.executeChat({
      messages,
      aiBrain,
      personality,
      memory,
      voiceAnalysis: voiceAnalysis || lastUserMsgObj?.voiceAnalysis,
      currentLanguage: activeLanguage,
    });

    return res.json({
      message: result.cleanText,
      cleanText: result.cleanText,
      text: result.cleanText,
      emotion: result.emotion,
      intensity: result.intensity,
      userEmotion: result.userEmotion,
      voiceStyle: result.voiceStyle,
      voiceSpeed: result.voiceSpeed,
      voicePitch: result.voicePitch,
      facialExpression: result.facialExpression,
      action: result.action,
      gesture: result.gesture,
      expression: result.expression,
      voice_direction: result.voice_direction,
      animation: result.animation,
      currentLanguage: result.currentLanguage,
      brain: result.diagnostic.selectedProvider,
      diagnostic: result.diagnostic,
    });
  } catch (error: any) {
    console.error("Chat API error:", error);
    const fallbackMessages: Record<string, string> = {
      English: "The stars whispered gently in the silence... What were we exploring together?",
      Hindi: "हवा में एक शांत झोंका बह गया... I am still here beside you, listening softly.",
      Bengali: "হাওয়ায় একটা শান্ত দোলা দিয়ে গেল... I am still here beside you, listening softly.",
      Japanese: "風が静かに通り過ぎていきましたね... I am still here beside you, listening softly.",
    };
    const fallbackText = fallbackMessages[activeLanguage] || fallbackMessages.English;
    return res.json({
      message: fallbackText,
      cleanText: fallbackText,
      text: fallbackText,
      emotion: "gentle",
      intensity: 0.3,
      expression: "[calm]",
      voice_direction: "",
      animation: "idle",
      currentLanguage: activeLanguage,
      brain: "fallback",
      diagnostic: {
        selectedProvider: "fallback_static",
        selectedModel: "none",
        taskType: "chat",
        selectionReason: "Exception caught in chat endpoint",
        latencyMs: 0,
        success: false,
        fallbackUsed: true,
        attemptedProviders: [],
        errors: { error: error?.message || "Fatal error" },
      },
    });
  }
});

// Proper-name vocabulary and heuristic correction rules
function normalizeVoiceTranscript(
  raw: string,
  recentContext: string
): { text: string; confidence: number; isNoise: boolean; reason?: string } {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    return { text: "", confidence: 0, isNoise: true, reason: "empty" };
  }

  // Recognized Vocal Sounds & Paralinguistic Expressions (DO NOT DISCARD)
  const vocalSoundMap: Record<string, string> = {
    hmm: "Hmm...",
    hmmm: "Hmm...",
    mmm: "Mmm...",
    hmph: "Hmph.",
    hmp: "Hmph.",
    uh: "Uh...",
    uhh: "Uh...",
    um: "Um...",
    umm: "Um...",
    ah: "Ah...",
    ahh: "Ah...",
    oh: "Oh...",
    ohh: "Oh...",
    wow: "Wow...",
    sigh: "*sigh*",
    haha: "Haha...",
    hahaha: "Hahaha...",
    hehe: "Hehe...",
    tsk: "Tsk...",
  };

  const pureSound = trimmed.replace(/^[^\w*]+|[^\w*]+$/g, "").toLowerCase();
  if (vocalSoundMap[pureSound]) {
    return {
      text: vocalSoundMap[pureSound],
      confidence: 0.88,
      isNoise: false,
    };
  }

  // Obvious background noise / clicks / solitary non-word characters
  const isNonLatin = /[^\x00-\x7F]/.test(trimmed);
  const words = trimmed.replace(/[^\p{L}\p{N}\s]/gu, "").trim().split(/\s+/);
  const validShortWords = new Set([
    "hi", "no", "ok", "go", "me", "we", "he", "do", "so", "up", "on", "in",
    "to", "am", "is", "it", "at", "my", "by", "us", "ah", "oh", "yes", "i"
  ]);
  if (
    !isNonLatin &&
    (trimmed.length < 2 ||
      (words.length === 1 &&
        words[0].length === 1 &&
        !validShortWords.has(words[0].toLowerCase())))
  ) {
    return { text: "", confidence: 0, isNoise: true, reason: "too_short_noise" };
  }

  let text = trimmed;

  // Custom Proper-Name Vocabulary Normalization:
  // Columbina (Colombina, Columbena, Columbine, Column bina, Callum bina)
  text = text.replace(
    /\b(colombina|columbena|columbine|column\s*bina|callum\s*bina|collumbina)\b/gi,
    "Columbina"
  );
  // Kuutar
  text = text.replace(/\b(kutar|coutar|kuuter|qutar)\b/gi, "Kuutar");
  // Nod-Krai
  text = text.replace(/\b(not\s*krai|nod\s+krai|nodkrai)\b/gi, "Nod-Krai");
  // Fatui
  text = text.replace(/\b(fat\s*ui|fatuey|fatuwy|fatuie)\b/gi, "Fatui");
  // Damselette
  text = text.replace(/\b(damsel\s*ette|damselet|damzellette|damsellette)\b/gi, "Damselette");
  // Silvermoon Hall
  text = text.replace(/\bsilver\s*moon(\s*hall)?\b/gi, (_m, p1) =>
    p1 ? "Silvermoon Hall" : "Silvermoon"
  );
  // Frostmoon Scions
  text = text.replace(/\bfrost\s*moon(\s*scions)?\b/gi, (_m, p1) =>
    p1 ? "Frostmoon Scions" : "Frostmoon"
  );
  // Trilune
  text = text.replace(/\b(tri\s*lune|triloon)\b/gi, "Trilune");
  // Hiisi Island
  text = text.replace(/\b(hisi|hissi)\s*island\b/gi, "Hiisi Island");
  // Moon Maiden / Moon Goddess
  text = text.replace(/\bmoon\s*maiden\b/gi, "Moon Maiden");
  text = text.replace(/\bmoon\s*goddess\b/gi, "Moon Goddess");

  // Common STT homophone fixes:
  // "too due" -> "to do", "to due" -> "to do"
  text = text.replace(/\btoo\s+due\b/gi, "to do");
  text = text.replace(/\bto\s+due\b/gi, "to do");
  text = text.replace(/\bdue\s+you\b/gi, "do you");
  text = text.replace(/\bare\s+you\s+their\b/gi, "are you there");
  text = text.replace(/\btheir\s+you\s+are\b/gi, "there you are");

  // Context-aware homophone resolution (e.g. "witch flowers" -> "which flowers")
  if (
    /\b(flowers?|stars?|places?|songs?|melod|things?|choice|like|prefer|one|which)\b/i.test(
      recentContext
    )
  ) {
    text = text.replace(/\bwitch\b/gi, "which");
  }

  // Capitalize sentence start
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  // Add question mark for question starters if missing punctuation
  if (!/[.?!,]$/.test(text)) {
    if (
      /^(what|why|how|where|when|who|which|is|are|do|does|did|can|could|will|would|have|has)\b/i.test(
        text
      )
    ) {
      text += "?";
    } else {
      text += ".";
    }
  }

  return { text, confidence: 0.90, isNoise: false };
}

// Voice Auto-Correction Endpoint
app.post("/api/voice/correct", async (req, res) => {
  try {
    const { rawTranscript, recentMessages = [], language = "en-US" } = req.body;
    const trimmed = (rawTranscript || "").trim();

    if (!trimmed) {
      return res.json({
        isNoise: true,
        rawTranscript: "",
        correctedText: "",
        confidence: 0,
        needsClarification: false,
        reason: "empty",
      });
    }

    // Context string from recent conversation turns
    const recentContext = recentMessages
      .slice(-4)
      .map(
        (m: any) =>
          `${m.role === "assistant" || m.role === "model" ? "Columbina" : "User"}: ${
            m.cleanText || m.content
          }`
      )
      .join("\n");

    // Fast rule-based check
    const heuristic = normalizeVoiceTranscript(trimmed, recentContext);
    if (heuristic.isNoise) {
      return res.json({
        isNoise: true,
        rawTranscript: trimmed,
        correctedText: "",
        confidence: 0,
        needsClarification: false,
        reason: heuristic.reason || "noise",
      });
    }

    // If Gemini is available, pass through AI context validation and homophone check
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = getGeminiClient();
        const correctionPrompt = `You are the high-precision speech-to-text auto-correction engine for Columbina (Moon Maiden / Kuutar / former Damselette of Fatui from Silvermoon Hall).
Raw STT transcript: "${trimmed}"
User spoken language locale: ${language}
Recent conversation context:
${recentContext || "(Beginning of conversation)"}

Custom vocabulary:
- Columbina (frequently transcribed as Colombina, Columbine, Columbena, Column bina, Callum bina)
- Kuutar, Nod-Krai, Fatui, Harbinger, Damselette, Moon Maiden, Moon Goddess, Silvermoon Hall, Frostmoon Scions, Trilune, Hiisi Island

CRITICAL RULES:
1. Determine what STT probably heard vs what the user most likely actually said.
2. Context-Aware: Disambiguate homophones (e.g., 'witch' vs 'which', 'too' vs 'to', 'due' vs 'do', 'there' vs 'their') using previous context.
3. Proper-Name Normalization: When addressing or referring to the companion, correct variations to "Columbina" or correct world names.
4. DO NOT OVER-CORRECT:
   - Do NOT rewrite or rephrase the user's sentence.
   - Do NOT invent words or add meaning the user did not say.
   - Preserve unusual phrasing, brief questions, or colloquial grammar if understandable.
   - Only correct speech recognition errors.
5. Internal Confidence System:
   - 0.90 to 1.00: High clarity, unambiguous, or standard well-formed message.
   - 0.70 to 0.89: Minor phonological/homophone error corrected using context.
   - 0.50 to 0.69: Heavily dependent on context or partial phonetic similarity.
   - Below 0.50: Incomprehensible acoustic noise, severe garble, or unintelligible audio.
6. If confidence < 0.50: Set needsClarification: true, and provide clarificationText (a gentle, in-character clarification Columbina will say, e.g. "Mm... I couldn't quite hear you. Could you say that again?").

Return ONLY JSON:
{
  "correctedText": "Columbina, what are you doing?",
  "confidence": 0.95,
  "needsClarification": false,
  "clarificationText": ""
}`;

        const candidateModels = [
          "gemini-3.1-flash-lite",
          "gemini-3.8-flash",
          "gemini-flash-latest",
        ];

        for (const candidate of candidateModels) {
          try {
            const resp = await ai.models.generateContent({
              model: candidate,
              contents: [{ parts: [{ text: correctionPrompt }] }],
              config: {
                responseMimeType: "application/json",
                temperature: 0.1,
              },
            });

            if (resp.text) {
              const parsed = JSON.parse(resp.text);
              const conf =
                typeof parsed.confidence === "number" ? parsed.confidence : 0.88;
              const needsClar = conf < 0.50 || Boolean(parsed.needsClarification);
              const corrected = (parsed.correctedText || heuristic.text).trim();

              return res.json({
                isNoise: false,
                rawTranscript: trimmed,
                correctedText: corrected || heuristic.text,
                confidence: conf,
                needsClarification: needsClar,
                clarificationText: needsClar
                  ? parsed.clarificationText ||
                    "Mm... I couldn't quite hear you. Could you say that again?"
                  : "",
              });
            }
          } catch (modelErr: any) {
            console.warn(
              `Voice correction model ${candidate} failed, trying fallback:`,
              modelErr?.message
            );
          }
        }
      } catch (geminiError: any) {
        console.warn(
          "Gemini voice correction exception, using heuristic result:",
          geminiError?.message
        );
      }
    }

    // Heuristic response if AI is unavailable or fails
    return res.json({
      isNoise: false,
      rawTranscript: trimmed,
      correctedText: heuristic.text,
      confidence: heuristic.confidence,
      needsClarification: false,
      clarificationText: "",
    });
  } catch (error: any) {
    console.error("Voice correction endpoint exception:", error);
    res.status(500).json({
      error: error.message || "Failed to process voice correction",
    });
  }
});

// Gemini TTS endpoint (high-grade delicate neural speech)
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice = "Aoede" } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Missing text parameter" });
    }

    // Clean emotion tags, asterisks, and excessive brackets before sending to TTS
    const speechText = text
      .replace(/^\[(happy|neutral|surprised|thinking|relaxed|sad|angry|wink)\]\s*/gi, "")
      .replace(/\*[^*]+\*/g, " ")
      .replace(/[*_#`~[\]()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!speechText) {
      return res.status(400).json({ error: "No spoken text remaining after cleanup" });
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: speechText }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(500).json({ error: "No audio data received from TTS model" });
    }

    res.json({
      audio: base64Audio,
      sampleRate: 24000,
    });
  } catch (error: any) {
    console.error("TTS API error:", error);
    res.status(500).json({ error: error.message || "Failed to generate TTS audio" });
  }
});

// Fish Audio TTS endpoint (s2.1-pro-free model with custom reference voice and contextual expression system)
// ...your other API routes above...

// Fish Audio TTS endpoint
app.post("/api/tts/fish", async (req, res) => {
  try {
    const {
      text,
      reference_id = "f2aed07c91614db28daaaa849150cc6e",
      expression = "",
      voice_direction = "",
    } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required" });
    }

    const fishApiKey = process.env.FISH_AUDIO_API_KEY;

    if (!fishApiKey) {
      console.error("FISH_AUDIO_API_KEY is missing");

      return res.status(500).json({
        error: "Fish Audio API key is not configured",
      });
    }

    const cleanText = text
      .replace(/^\[.*?\]\s*/g, "")
      .replace(
        /\((whispering|sighing|laughing|panting|shouting)\)/gi,
        ""
      )
      .replace(/\*[^*]+\*/g, "")
      .trim();

    const fishResponse = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fishApiKey}`,
        "Content-Type": "application/json",
        model: "s2.1-pro-free",
      },
      body: JSON.stringify({
        text: cleanText,
        reference_id,
        format: "mp3",
      }),
    });

    if (!fishResponse.ok) {
      const errorText = await fishResponse.text();

      console.error(
        "Fish Audio error:",
        fishResponse.status,
        errorText
      );

      return res.status(fishResponse.status).json({
        error: `Fish Audio request failed: ${errorText}`,
      });
    }

    const audioBuffer = Buffer.from(
      await fishResponse.arrayBuffer()
    );

    return res.json({
      audio: audioBuffer.toString("base64"),
      format: "mp3",
      contentType: "audio/mpeg",
    });
  } catch (error: any) {
    console.error("Fish TTS error:", error);

    return res.status(500).json({
      error: error?.message || "Fish Audio TTS failed",
    });
  }
});

// Shortcut to model proxy for default local VRM paths
app.get(["/columbinamodel.vrm", "/model.vrm"], (_req, res) => {
  res.redirect("/api/model-proxy");
});

// Mount Vite middleware in development or serve static files in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VRM AI Assistant server listening on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) { startServer(); }

export default app;
