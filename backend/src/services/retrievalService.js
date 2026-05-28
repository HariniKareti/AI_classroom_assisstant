import { env } from "../config/env.js";
import { generateEmbedding } from "./embeddingService.js";
import { queryLectureChunks } from "./chromaService.js";
import { logger } from "../utils/logger.js";

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "being",
  "below",
  "between",
  "could",
  "every",
  "first",
  "from",
  "have",
  "into",
  "just",
  "more",
  "other",
  "same",
  "should",
  "some",
  "such",
  "than",
  "that",
  "their",
  "them",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "very",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your",
  "currently",
  "computer",
  "science",
  "engineering",
  "studying"
]);

const tokenize = (value) =>
  [...new Set(
    String(value || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 3 && !STOP_WORDS.has(token))
  )];

const rankChromaMatches = (matches, transcript) => {
  const transcriptText = String(transcript || "").toLowerCase();
  const transcriptTokens = tokenize(transcriptText);
  const scoredMatches = matches
    .map((chunk, index) => {
      const chunkText = String(chunk.text || "").toLowerCase();
      const overlappingTokens = transcriptTokens.filter((token) => chunkText.includes(token));
      const transcriptOverlap = overlappingTokens.length;
      const overlapRatio = transcriptTokens.length ? transcriptOverlap / transcriptTokens.length : 0;
      const semanticScore = 1 / (1 + Math.max(0, Number(chunk.distance) || 0));
      const hasStrongSemanticMatch = semanticScore >= 0.72;
      const hasSupportedSemanticMatch = semanticScore >= 0.6 && (transcriptOverlap >= 1 || overlapRatio >= 0.08);

      return {
        index: Number.isFinite(chunk.metadata?.chunkIndex) ? chunk.metadata.chunkIndex : index,
        text: chunk.text,
        distance: Number(chunk.distance) || 0,
        semanticScore,
        transcriptOverlap,
        overlapRatio,
        overlappingTokens,
        hybridScore: semanticScore * 0.8 + Math.min(transcriptOverlap, 4) * 0.08 + overlapRatio * 0.12,
        passesRelevanceGate: hasStrongSemanticMatch || hasSupportedSemanticMatch
      };
    });

  const topSemanticScore = scoredMatches.reduce(
    (bestScore, chunk) => Math.max(bestScore, chunk.semanticScore),
    0
  );

  const filtered = scoredMatches
    .filter((chunk) => {
      if (chunk.semanticScore <= 0) {
        return false;
      }

      const isNearTopSemanticMatch = topSemanticScore >= 0.56 && chunk.semanticScore >= topSemanticScore - 0.06;
      const hasMinimumSemanticStrength = chunk.semanticScore >= 0.56;

      return (chunk.passesRelevanceGate && chunk.semanticScore >= 0.58) || (isNearTopSemanticMatch && hasMinimumSemanticStrength);
    })
    .sort((a, b) => b.hybridScore - a.hybridScore || b.transcriptOverlap - a.transcriptOverlap)
    .slice(0, env.maxContextChunks);

  logger.info("Chroma candidate scoring summary.", {
    transcriptPreview: transcript.slice(0, 160),
    transcriptTokens,
    topSemanticScore,
    candidates: scoredMatches.slice(0, 5).map((chunk) => ({
      index: chunk.index,
      distance: chunk.distance,
      semanticScore: chunk.semanticScore,
      transcriptOverlap: chunk.transcriptOverlap,
      overlapRatio: chunk.overlapRatio,
      overlappingTokens: chunk.overlappingTokens,
      passesRelevanceGate: chunk.passesRelevanceGate,
      preview: String(chunk.text || "").slice(0, 180)
    })),
    selectedIndexes: filtered.map((chunk) => chunk.index)
  });

  return filtered;
};

export const retrieveRelevantChunksByTranscript = async (lecture, transcript = "") => {
  if (!lecture.material?.vectorCollection || !lecture.material?.chunksCount || !transcript.trim()) {
    return [];
  }

  try {
    const embedding = await generateEmbedding(transcript);
    if (!embedding.length) {
      return [];
    }

    const chromaMatches = await queryLectureChunks({
      collectionName: lecture.material.vectorCollection,
      embedding,
      limit: Math.max(env.maxContextChunks * 2, 8)
    });

    return rankChromaMatches(chromaMatches, transcript);
  } catch (error) {
    logger.error("Chroma retrieval failed. Falling back to transcript-only generation.", {
      lectureId: String(lecture._id || ""),
      collectionName: lecture.material?.vectorCollection || "",
      message: error.message
    });
    return [];
  }
};
