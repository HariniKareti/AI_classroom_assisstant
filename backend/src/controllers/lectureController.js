import { Lecture } from "../models/Lecture.js";
import { Question } from "../models/Question.js";
import { QuizAttempt } from "../models/QuizAttempt.js";
import { SessionEnrollment } from "../models/SessionEnrollment.js";
import { appendIntervalTranscript, attachMaterialToLecture, createLectureSession } from "../services/lectureService.js";
import { generateQuestionForTranscriptWindow } from "../services/generationService.js";
import { extractTextFromPdfBuffer } from "../services/pdfService.js";
import { deleteLectureCollection } from "../services/chromaService.js";
import { emitSessionUpdated } from "../services/socketService.js";

const serializeWindow = (window) => ({
  windowId: window.windowId,
  transcript: window.transcript,
  status: window.status,
  startedAt: window.startedAt,
  endedAt: window.endedAt,
  processedAt: window.processedAt
});

const lectureSummary = (lecture, extra = {}) => ({
  _id: lecture._id,
  title: lecture.title,
  joinCode: lecture.joinCode,
  uploadedBy: lecture.uploadedBy,
  intervalMinutes: lecture.intervalMinutes,
  status: lecture.status,
  startedAt: lecture.startedAt,
  endedAt: lecture.endedAt,
  lastGeneratedAt: lecture.lastGeneratedAt,
  createdAt: lecture.createdAt,
  material: {
    fileName: lecture.material?.fileName || "",
    uploadedAt: lecture.material?.uploadedAt || null,
    chunksCount: lecture.material?.chunksCount || 0
  },
  recentWindows: (lecture.windows || [])
    .map(serializeWindow)
    .sort((left, right) => new Date(right.processedAt || 0).getTime() - new Date(left.processedAt || 0).getTime()),
  pendingWindows: (lecture.windows || []).filter((window) => window.status === "pending").map(serializeWindow),
  ...extra
});

export const createLecture = async (req, res) => {
  const { title } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ message: "Session name is required." });
  }

  const lecture = await createLectureSession({
    title: title.trim(),
    uploadedBy: req.user._id
  });

  try {
    if (!req.file) {
      return res.status(201).json({
        message: "Session created successfully.",
        lecture: lectureSummary(lecture)
      });
    }

    lecture.status = "ingesting";
    await lecture.save();

    const extractedText = await extractTextFromPdfBuffer(req.file.buffer);
    if (!extractedText) {
      await Lecture.findByIdAndDelete(lecture._id);
      return res.status(400).json({ message: "Could not extract text from the uploaded PDF." });
    }

    const updatedLecture = await attachMaterialToLecture({
      lectureId: lecture._id,
      fileName: req.file.originalname,
      rawText: extractedText
    });

    res.status(201).json({
      message: "Session created successfully.",
      lecture: lectureSummary(updatedLecture)
    });
  } catch (error) {
    await deleteLectureCollection(lecture.material?.vectorCollection);
    await Lecture.findByIdAndDelete(lecture._id);
    error.message = `Knowledge base upload failed: ${error.message}`;
    throw error;
  }
};

export const getLectures = async (req, res) => {
  if (req.user.role === "teacher") {
    const lectures = await Lecture.find({ uploadedBy: req.user._id }).sort({ createdAt: -1 });
    return res.json({ lectures: lectures.map((lecture) => lectureSummary(lecture)) });
  }

  const joinedEnrollments = await SessionEnrollment.find({
    student: req.user._id,
    status: "active"
  }).lean();
  const joinedLectureIds = new Set(joinedEnrollments.map((enrollment) => String(enrollment.lecture)));

  const lectures = await Lecture.find({
    status: { $in: ["ingesting", "ready", "active", "completed"] }
  }).sort({ createdAt: -1 });

  res.json({
    lectures: lectures.map((lecture) =>
      lectureSummary(lecture, {
        joinCode: undefined,
        joined: joinedLectureIds.has(String(lecture._id))
      })
    )
  });
};

export const joinLecture = async (req, res) => {
  const { joinCode } = req.body;

  if (!joinCode?.trim()) {
    return res.status(400).json({ message: "Join code is required." });
  }

  const lecture = await Lecture.findOne({ joinCode: joinCode.trim().toUpperCase() });
  if (!lecture || lecture.status === "completed" || lecture.status === "ingesting") {
    return res.status(404).json({ message: "No joinable session found for that code." });
  }

  await SessionEnrollment.findOneAndUpdate(
    {
      lecture: lecture._id,
      student: req.user._id
    },
    {
      lecture: lecture._id,
      student: req.user._id,
      status: "active",
      joinedAt: new Date()
    },
    {
      new: true,
      upsert: true
    }
  );

  res.json({
    message: "Joined session successfully.",
    lecture: lectureSummary(lecture, { joined: true, joinCode: undefined })
  });
};

export const startLecture = async (req, res) => {
  const { lectureId } = req.params;
  const { intervalMinutes } = req.body;

  const lecture = await Lecture.findById(lectureId);
  if (!lecture) {
    return res.status(404).json({ message: "Session not found." });
  }

  if (String(lecture.uploadedBy) !== String(req.user._id)) {
    return res.status(403).json({ message: "Only the session owner can start this session." });
  }

  if (lecture.status === "completed") {
    return res.status(400).json({ message: "Completed sessions cannot be started again." });
  }

  if (lecture.status === "active") {
    return res.status(400).json({ message: "This session is already active." });
  }

  const parsedInterval = Number(intervalMinutes);
  if (![1, 2, 3, 4, 5].includes(parsedInterval)) {
    return res.status(400).json({ message: "Interval must be between 1 and 5 minutes." });
  }

  await Question.updateMany({ lecture: lecture._id, status: "active" }, { status: "expired" });
  lecture.intervalMinutes = parsedInterval;
  lecture.status = "active";
  lecture.startedAt = new Date();
  lecture.currentWindowTranscript = "";
  lecture.activeQuestion = null;
  await lecture.save();

  emitSessionUpdated(String(lecture._id), {
    lectureId: String(lecture._id),
    status: lecture.status,
    intervalMinutes: lecture.intervalMinutes,
    startedAt: lecture.startedAt
  });

  res.json({
    message: "Session started.",
    lecture: lectureSummary(lecture)
  });
};

export const endLecture = async (req, res) => {
  const { lectureId } = req.params;
  const lecture = await Lecture.findById(lectureId);

  if (!lecture) {
    return res.status(404).json({ message: "Session not found." });
  }

  if (String(lecture.uploadedBy) !== String(req.user._id)) {
    return res.status(403).json({ message: "Only the session owner can end this session." });
  }

  if (lecture.status !== "active") {
    return res.status(400).json({ message: "Only active sessions can be ended." });
  }

  lecture.status = "completed";
  lecture.endedAt = new Date();
  lecture.currentWindowTranscript = "";
  lecture.activeQuestion = null;
  lecture.windows.forEach((window) => {
    if (window.status === "pending") {
      window.status = "skipped";
    }
  });
  await lecture.save();
  await Question.updateMany({ lecture: lecture._id, status: "active" }, { status: "expired" });

  emitSessionUpdated(String(lecture._id), {
    lectureId: String(lecture._id),
    status: lecture.status,
    endedAt: lecture.endedAt
  });

  res.json({
    message: "Session ended.",
    lecture: lectureSummary(lecture)
  });
};

export const deleteLecture = async (req, res) => {
  const { lectureId } = req.params;
  const lecture = await Lecture.findById(lectureId);

  if (!lecture) {
    return res.status(404).json({ message: "Session not found." });
  }

  if (String(lecture.uploadedBy) !== String(req.user._id)) {
    return res.status(403).json({ message: "Only the session owner can delete this session." });
  }

  await deleteLectureCollection(lecture.material?.vectorCollection);
  await Promise.all([
    QuizAttempt.deleteMany({ lecture: lecture._id }),
    Question.deleteMany({ lecture: lecture._id }),
    SessionEnrollment.deleteMany({ lecture: lecture._id }),
    Lecture.findByIdAndDelete(lectureId)
  ]);

  res.json({ message: "Session deleted successfully." });
};

export const processIntervalTranscript = async (req, res) => {
  const { lectureId } = req.params;
  const { transcript, startedAt, endedAt } = req.body;

  if (!transcript?.trim()) {
    return res.status(400).json({ message: "Transcript is required." });
  }

  const lecture = await Lecture.findById(lectureId);
  if (!lecture) {
    return res.status(404).json({ message: "Session not found." });
  }

  if (String(lecture.uploadedBy) !== String(req.user._id)) {
    return res.status(403).json({ message: "Only the session owner can process interval transcript." });
  }

  if (lecture.status !== "active") {
    return res.status(400).json({ message: "Start the session before processing interval transcripts." });
  }

  const { lecture: updatedLecture, windowTranscript, pendingWindow } = await appendIntervalTranscript({
    lectureId,
    transcript,
    startedAt,
    endedAt
  });

  if (!windowTranscript || !pendingWindow) {
    return res.json({ pendingWindow: null, message: "No usable transcript captured for this interval." });
  }

  const result = await generateQuestionForTranscriptWindow({
    lecture: updatedLecture,
    generatedBy: req.user._id,
    windowId: pendingWindow.windowId
  });
  const refreshedLecture = await Lecture.findById(lectureId);
  const hasKnowledgeBase = Boolean(updatedLecture.material?.vectorCollection && updatedLecture.material?.chunksCount);

  res.json({
    pendingWindow: result.question ? null : serializeWindow(pendingWindow),
    question: result.question,
    lecture: lectureSummary(refreshedLecture),
    message: result.question
      ? result.matchedChunks.length
        ? "Transcript captured and question generated from retrieved knowledge-base context."
        : hasKnowledgeBase
          ? "Transcript captured and question generated from the transcript because no relevant knowledge-base chunks were found."
          : "Transcript captured and question generated directly from the transcript."
      : "Transcript captured, but no MCQ could be generated for this interval."
  });
};

export const generateQuestionFromWindow = async (req, res) => {
  const { lectureId, windowId } = req.params;

  const lecture = await Lecture.findById(lectureId);
  if (!lecture) {
    return res.status(404).json({ message: "Session not found." });
  }

  if (String(lecture.uploadedBy) !== String(req.user._id)) {
    return res.status(403).json({ message: "Only the session owner can generate questions for this interval." });
  }

  const result = await generateQuestionForTranscriptWindow({
    lecture,
    generatedBy: req.user._id,
    windowId
  });

  const refreshedLecture = await Lecture.findById(lectureId);
  const hasKnowledgeBase = Boolean(lecture.material?.vectorCollection && lecture.material?.chunksCount);
  res.json({
    question: result.question,
    lecture: lectureSummary(refreshedLecture),
    message: result.matchedChunks.length
      ? "Question generated from relevant knowledge-base context."
      : hasKnowledgeBase
        ? "No sufficiently relevant knowledge-base chunks matched, so the question was generated from the transcript only."
        : "Question generated directly from the interval transcript because this session has no knowledge base."
  });
};
