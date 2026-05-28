import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || "development",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  mongoUri: process.env.MONGODB_URI || "",
  jwtSecret: process.env.JWT_SECRET || "development-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiTextModel: process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash",
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
  chromaUrl: process.env.CHROMA_URL || "http://localhost:8000",
  chromaCollectionPrefix: process.env.CHROMA_COLLECTION_PREFIX || "aqg-session",
  maxContextChunks: Number(process.env.MAX_CONTEXT_CHUNKS || 5),
  cookieSecure: process.env.COOKIE_SECURE === "true"
};
