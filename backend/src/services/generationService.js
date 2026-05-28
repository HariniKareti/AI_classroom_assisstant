import { Question } from "../models/Question.js";
import { generateQuestionFromTranscriptContext, generateQuestionFromTranscriptOnly } from "./questionService.js";
import { retrieveRelevantChunksByTranscript } from "./retrievalService.js";
import { emitQuestionGenerated, emitSessionUpdated } from "./socketService.js";
import { logger } from "../utils/logger.js";

export const generateQuestionForTranscriptWindow = async ({
  lecture,
  generatedBy,
  windowId
}) => {
  const lectureWindow = lecture.windows.find((window) => window.windowId === windowId);
  if (!lectureWindow) {
    throw new Error("Interval window not found.");
  }

  const transcript = String(lectureWindow.transcript || "").trim();
  if (!transcript) {
    return { question: null, matchedChunks: [] };
  }

  const contextChunks = await retrieveRelevantChunksByTranscript(lecture, transcript);
  logger.info("Transcript-guided Chroma retrieval completed.", {
    lectureId: String(lecture._id),
    windowId,
    transcriptPreview: transcript.slice(0, 180),
    matchedChunks: contextChunks.map((chunk) => ({
      index: chunk.index,
      hybridScore: chunk.hybridScore,
      semanticScore: chunk.semanticScore,
      transcriptOverlap: chunk.transcriptOverlap,
      text: String(chunk.text || "")
    }))
  });
  if (!contextChunks.length) {
    logger.info("No sufficiently relevant Chroma chunks matched. Falling back to transcript-only generation.", {
      lectureId: String(lecture._id),
      windowId,
      hasKnowledgeBase: Boolean(lecture.material?.vectorCollection && lecture.material?.chunksCount)
    });
  }

  const generated = contextChunks.length
    ? await generateQuestionFromTranscriptContext({
        transcript,
        contextChunks
      })
    : await generateQuestionFromTranscriptOnly({
        transcript,
        fromKnowledgeBaseFallback: Boolean(lecture.material?.vectorCollection && lecture.material?.chunksCount)
      });

  if (!generated?.question || !generated?.answer || !Array.isArray(generated?.options) || generated.options.length !== 4) {
    lectureWindow.status = "skipped";
    lecture.metrics.generationRuns += 1;
    await lecture.save();
    logger.warn("Question generation returned no valid MCQ.", {
      lectureId: String(lecture._id),
      windowId,
      usedKnowledgeBase: Boolean(contextChunks.length)
    });
    return { question: null, matchedChunks: contextChunks };
  }

  await Question.updateMany(
    {
      lecture: lecture._id,
      status: "active"
    },
    {
      status: "expired"
    }
  );

  const expiresAt = new Date(new Date(lectureWindow.endedAt || Date.now()).getTime() + lecture.intervalMinutes * 60 * 1000);
  const question = await Question.create({
    lecture: lecture._id,
    generatedBy,
    question: generated.question,
    options: generated.options,
    answer: generated.answer,
    retrievedChunks: contextChunks.map((chunk) => chunk.text),
    retrievalKeywords: [],
    sourceTranscript: lectureWindow.transcript,
    intervalStartedAt: lectureWindow.startedAt,
    intervalEndedAt: lectureWindow.endedAt,
    expiresAt
  });

  lectureWindow.generatedQuestionId = question._id;
  lectureWindow.status = "generated";
  lecture.lastGeneratedAt = new Date();
  lecture.activeQuestion = question._id;
  lecture.currentWindowTranscript = "";
  lecture.metrics.questionsGenerated += 1;
  lecture.metrics.generationRuns += 1;
  await lecture.save();

  emitQuestionGenerated(String(lecture._id), {
    lectureId: String(lecture._id),
    question
  });
  emitSessionUpdated(String(lecture._id), {
    lectureId: String(lecture._id),
    status: lecture.status,
    activeQuestionId: String(question._id)
  });

  return { question, matchedChunks: contextChunks };
};
