import { normalizeText, chunkText } from "../utils/chunkText.js";
import { Lecture } from "../models/Lecture.js";
import { generateEmbedding } from "./embeddingService.js";
import { buildCollectionName, upsertLectureChunks } from "./chromaService.js";
import { randomBytes } from "crypto";

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "with",
  "this",
  "from",
  "have",
  "into",
  "about",
  "your",
  "their",
  "there",
  "were",
  "when",
  "where",
  "which",
  "while",
  "what",
  "will",
  "would",
  "could",
  "should",
  "then",
  "than",
  "each",
  "been",
  "being",
  "them",
  "they",
  "these",
  "those",
  "because",
  "very",
  "also",
  "just",
  "only",
  "into",
  "over",
  "under",
  "between"
]);

const extractKeywords = (text) => {
  const frequencies = new Map();
  const tokens = normalizeText(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));

  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) || 0) + 1);
  }

  return [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([token]) => token);
};

const generateJoinCode = () => randomBytes(3).toString("hex").toUpperCase();

export const generateUniqueJoinCode = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const joinCode = generateJoinCode();
    const existing = await Lecture.exists({ joinCode });
    if (!existing) {
      return joinCode;
    }
  }

  throw new Error("Failed to generate a unique join code.");
};

export const createLectureSession = async ({ title, uploadedBy }) =>
  Lecture.create({
    title,
    uploadedBy,
    joinCode: await generateUniqueJoinCode(),
    status: "ready"
  });

export const appendIntervalTranscript = async ({
  lectureId,
  transcript,
  startedAt,
  endedAt
}) => {
  const lecture = await Lecture.findById(lectureId);
  if (!lecture) {
    throw new Error("Lecture not found.");
  }

  const normalizedTranscript = normalizeText(transcript);
  if (!normalizedTranscript) {
    return { lecture, windowTranscript: "" };
  }

  lecture.currentWindowTranscript = normalizedTranscript;
  lecture.lastProcessedTranscript = normalizedTranscript;
  const suggestedKeywords = extractKeywords(normalizedTranscript);
  lecture.windows.push({
    windowId: randomBytes(8).toString("hex"),
    transcript: normalizedTranscript,
    suggestedKeywords,
    selectedKeywords: [],
    status: "pending",
    startedAt,
    endedAt,
    processedAt: new Date()
  });
  await lecture.save();

  return {
    lecture,
    windowTranscript: normalizedTranscript,
    pendingWindow: lecture.windows[lecture.windows.length - 1]
  };
};

export const attachMaterialToLecture = async ({ lectureId, fileName, rawText }) => {
  const lecture = await Lecture.findById(lectureId);
  if (!lecture) {
    throw new Error("Lecture not found.");
  }

  const normalizedText = normalizeText(rawText);
  const chunks = chunkText(normalizedText);
  const embeddedChunks = [];
  const collectionName = buildCollectionName(lectureId);

  for (const chunk of chunks) {
    const text = normalizeText(chunk.text);
    embeddedChunks.push({
      id: `${lectureId}-${chunk.index}`,
      lectureId: String(lectureId),
      index: chunk.index,
      text,
      embedding: await generateEmbedding(text),
      keywords: extractKeywords(text)
    });
  }

  await upsertLectureChunks({
    collectionName,
    chunks: embeddedChunks
  });

  lecture.material = {
    fileName,
    contentType: "application/pdf",
    rawText: normalizedText,
    chunksCount: embeddedChunks.length,
    vectorCollection: collectionName,
    uploadedAt: new Date()
  };
  lecture.status = "ready";

  await lecture.save();
  return lecture;
};

export const extractKeywordsFromTranscript = (transcript) => extractKeywords(transcript);
