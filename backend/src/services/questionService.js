import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";
import { cache } from "./cacheService.js";
import { sha256 } from "../utils/hash.js";
import { logger } from "../utils/logger.js";

const client = env.geminiApiKey ? new GoogleGenerativeAI(env.geminiApiKey) : null;

const buildContextPrompt = ({ transcript, contextText }) => `You are generating one timed classroom MCQ for a live lecture.
Rules:
- The teacher transcript below is only the live query signal.
- Generate the MCQ using ONLY the retrieved knowledge-base context below.
- Do NOT hallucinate or use outside knowledge.
- If the context is insufficient to create one high-quality MCQ, return {}.
- Output must be valid JSON only.
- Return exactly one JSON object using:
{"question":"","options":["","","",""],"answer":""}
- Provide exactly 4 distinct options.
- The answer must exactly match one of the options.
- The question must be clear and based only on the provided knowledge-base context.

Last processed transcript:
${transcript}

Retrieved knowledge-base context:
${contextText}`;

const buildTranscriptOnlyPrompt = ({ transcript, modeLabel }) => `You are generating one timed classroom MCQ for a live lecture.
Rules:
- ${modeLabel}
- Generate one MCQ on the main topic or concept found in the transcript below.
- You may rely on your pretrained knowledge to frame the question, but stay tightly aligned to the transcript topic.
- Output must be valid JSON only.
- Return exactly one JSON object using:
{"question":"","options":["","","",""],"answer":""}
- Provide exactly 4 distinct options.
- The answer must exactly match one of the options.

Transcript:
${transcript}`;

const stripCodeFences = (value) => value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");

const sanitizeQuestion = (item) => {
  if (!item?.question || !item?.answer || !Array.isArray(item?.options) || item.options.length !== 4) {
    return null;
  }

  const question = item.question.trim();
  const options = item.options.map((option) => String(option).trim()).filter(Boolean).slice(0, 4);
  const answer = String(item.answer).trim();

  if (options.length !== 4 || !options.includes(answer)) {
    return null;
  }

  return {
    question,
    options,
    answer
  };
};

const callGeminiForQuestion = async (prompt, cacheKey) => {
  const cached = cache.get(cacheKey);
  if (cached) {
    const sanitizedCached = sanitizeQuestion(cached);
    if (sanitizedCached) {
      return sanitizedCached;
    }
    cache.del(cacheKey);
  }

  if (!client) {
    throw new Error("Gemini API key is missing.");
  }

  logger.info("Gemini prompt with augmented chunks.", { prompt });

  const model = client.getGenerativeModel({ model: env.geminiTextModel });
  const response = await model.generateContent(prompt);
  const rawText = stripCodeFences(response.response.text().trim());

  try {
    const parsed = JSON.parse(rawText);
    const sanitized = sanitizeQuestion(parsed);
    if (!sanitized) {
      logger.warn("Gemini question response did not match required MCQ schema.", { rawText });
      return null;
    }
    cache.set(cacheKey, sanitized);
    return sanitized;
  } catch (error) {
    logger.warn("Failed to parse Gemini question response.", { rawText });
    return null;
  }
};

export const generateQuestionFromTranscriptContext = async ({ transcript, contextChunks }) => {
  const contextText = contextChunks.map((chunk) => chunk.text).join("\n\n").trim();
  if (!contextText) {
    return null;
  }

  const cacheKey = `questions:v5:context:${sha256(`${transcript}::${contextText}`)}`;
  return callGeminiForQuestion(buildContextPrompt({ transcript, contextText }), cacheKey);
};

export const generateQuestionFromTranscriptOnly = async ({ transcript, fromKnowledgeBaseFallback = false }) => {
  if (!transcript.trim()) {
    return null;
  }

  const modeLabel = fromKnowledgeBaseFallback
    ? "No relevant knowledge-base chunks were found, so use the transcript topic directly."
    : "No knowledge base exists for this session, so use the transcript topic directly.";
  const cacheKey = `questions:v5:transcript:${sha256(`${fromKnowledgeBaseFallback ? "fallback" : "plain"}::${transcript}`)}`;
  return callGeminiForQuestion(buildTranscriptOnlyPrompt({ transcript, modeLabel }), cacheKey);
};
