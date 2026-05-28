import { ChromaClient } from "chromadb";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

let clientInstance = null;

const getClient = () => {
  if (!clientInstance) {
    clientInstance = new ChromaClient({ path: env.chromaUrl });
  }

  return clientInstance;
};

export const buildCollectionName = (lectureId) => `${env.chromaCollectionPrefix}-${lectureId}`;

export const upsertLectureChunks = async ({ collectionName, chunks }) => {
  const client = getClient();
  const collection = await client.getOrCreateCollection({
    name: collectionName,
    embeddingFunction: null
  });

  if (!chunks.length) {
    return collection;
  }

  await collection.upsert({
    ids: chunks.map((chunk) => chunk.id),
    documents: chunks.map((chunk) => chunk.text),
    embeddings: chunks.map((chunk) => chunk.embedding),
    metadatas: chunks.map((chunk) => ({
      lectureId: chunk.lectureId,
      chunkIndex: chunk.index,
      keywords: chunk.keywords.join(",")
    }))
  });

  logger.info("Knowledge-base chunks upserted into Chroma.", {
    collectionName,
    chunksCount: chunks.length
  });

  return collection;
};

export const queryLectureChunks = async ({ collectionName, embedding, limit }) => {
  const client = getClient();
  const collection = await client.getCollection({
    name: collectionName,
    embeddingFunction: null
  });
  const response = await collection.query({
    queryEmbeddings: [embedding],
    nResults: limit,
    include: ["documents", "metadatas", "distances"]
  });

  const documents = response.documents?.[0] || [];
  const metadatas = response.metadatas?.[0] || [];
  const distances = response.distances?.[0] || [];

  const matches = documents.map((text, index) => ({
    text,
    metadata: metadatas[index] || {},
    distance: Number.isFinite(distances[index]) ? distances[index] : 0
  }));

  logger.info("Chroma vector search completed.", {
    collectionName,
    requestedResults: limit,
    returnedResults: matches.length
  });

  return matches;
};

export const deleteLectureCollection = async (collectionName) => {
  if (!collectionName) {
    return;
  }

  const client = getClient();
  await client.deleteCollection({ name: collectionName }).catch(() => null);
};
