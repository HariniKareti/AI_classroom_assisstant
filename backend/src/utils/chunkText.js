const sentenceBoundary = /(?<=[.!?])\s+/;

export const normalizeText = (text = "") =>
  text.replace(/\s+/g, " ").replace(/[^\S\r\n]+/g, " ").trim();

export const chunkText = (text, options = {}) => {
  const cleanText = normalizeText(text);
  const maxChunkLength = options.maxChunkLength || 800;
  const overlapLength = options.overlapLength || 120;

  if (!cleanText) {
    return [];
  }

  const sentences = cleanText.split(sentenceBoundary);
  const chunks = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const nextChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
    if (nextChunk.length <= maxChunkLength) {
      currentChunk = nextChunk;
      continue;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    const overlap = currentChunk.slice(Math.max(0, currentChunk.length - overlapLength));
    currentChunk = normalizeText(`${overlap} ${sentence}`);
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.map((chunk, index) => ({
    index,
    text: chunk,
    wordCount: chunk.split(/\s+/).filter(Boolean).length
  }));
};
