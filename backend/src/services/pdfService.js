import pdfParse from "pdf-parse";
import { normalizeText } from "../utils/chunkText.js";

export const extractTextFromPdfBuffer = async (buffer) => {
  const parsed = await pdfParse(buffer);
  return normalizeText(parsed.text || "");
};
