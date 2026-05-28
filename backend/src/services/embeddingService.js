import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";
import { cache } from "./cacheService.js";
import { sha256 } from "../utils/hash.js";

const client = env.geminiApiKey ? new GoogleGenerativeAI(env.geminiApiKey) : null;

export const generateEmbedding = async (text) => {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return [];
  }

  const cacheKey = `embedding:${sha256(normalizedText)}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  if (!client) {
    throw new Error("Gemini API key is missing.");
  }

  const model = client.getGenerativeModel({ model: env.geminiEmbeddingModel });
  const response = await model.embedContent(normalizedText);
  const values = response.embedding?.values || [];
  cache.set(cacheKey, values);
  return values;
};

export const cosineSimilarity = (a = [], b = []) => {
  if (!a.length || !b.length || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    magA += a[index] * a[index];
    magB += b[index] * b[index];
  }

  if (!magA || !magB) {
    return 0;
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};
