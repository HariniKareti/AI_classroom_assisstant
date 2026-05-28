import { Lecture } from "../models/Lecture.js";
import { Question } from "../models/Question.js";
import { QuizAttempt } from "../models/QuizAttempt.js";
import { User } from "../models/User.js";
import { SessionEnrollment } from "../models/SessionEnrollment.js";
import { emitScoreboardUpdated } from "../services/socketService.js";

const buildTeacherLeaderboard = async (lecture) => {
  const scoreRows = await QuizAttempt.aggregate([
    { $match: { lecture: lecture._id } },
    {
      $group: {
        _id: "$student",
        score: { $sum: "$scoreAwarded" },
        answered: { $sum: 1 },
        correct: {
          $sum: {
            $cond: ["$isCorrect", 1, 0]
          }
        },
        wrong: {
          $sum: {
            $cond: ["$isCorrect", 0, 1]
          }
        }
      }
    }
  ]);

  const enrolled = await SessionEnrollment.find({ lecture: lecture._id }).populate("student", "name email").lean();
  const studentIds = [...new Set(enrolled.map((row) => String(row.student?._id)).filter(Boolean))];
  const scoreMap = new Map(
    scoreRows.map((row) => [
      String(row._id),
      {
        score: row.score,
        answered: row.answered,
        correct: row.correct,
        wrong: row.wrong
      }
    ])
  );
  const totalQuestionsGenerated = await Question.countDocuments({ lecture: lecture._id });

  return studentIds.map((studentId) => {
    const enrollment = enrolled.find((row) => String(row.student?._id) === studentId);
    const stats = scoreMap.get(studentId) || {
      score: 0,
      answered: 0,
      correct: 0,
      wrong: 0
    };

    return {
      studentId,
      studentName: enrollment.student?.name || "Unknown",
      studentEmail: enrollment.student?.email || "",
      score: stats.score,
      answered: stats.answered,
      correct: stats.correct,
      wrong: stats.wrong,
      unattempted: Math.max(0, totalQuestionsGenerated - stats.answered),
      totalQuestionsGenerated
    };
  }).sort((a, b) => b.score - a.score || a.studentName.localeCompare(b.studentName));
};

export const listQuestions = async (req, res) => {
  const filter = req.query.lectureId ? { lecture: req.query.lectureId } : {};
  const questions = await Question.find(filter).sort({ createdAt: -1 });

  if (req.user.role !== "student") {
    return res.json({ questions });
  }

  const attempts = await QuizAttempt.find({
    student: req.user._id,
    ...(req.query.lectureId ? { lecture: req.query.lectureId } : {})
  }).lean();
  const attemptsByQuestion = new Map(attempts.map((attempt) => [String(attempt.question), attempt]));

  res.json({
    questions: questions.map((question) => ({
      ...question.toObject(),
      userAttempt: attemptsByQuestion.get(String(question._id)) || null
    }))
  });
};

export const submitAnswer = async (req, res) => {
  const { questionId, selectedOption } = req.body;

  if (!questionId || !selectedOption?.trim()) {
    return res.status(400).json({ message: "questionId and selectedOption are required." });
  }

  const question = await Question.findById(questionId);
  if (!question) {
    return res.status(404).json({ message: "Question not found." });
  }

  const enrollment = await SessionEnrollment.findOne({
    lecture: question.lecture,
    student: req.user._id,
    status: "active"
  });

  if (!enrollment) {
    return res.status(403).json({ message: "Join this session before answering its questions." });
  }

  if (question.status === "expired" || new Date(question.expiresAt).getTime() < Date.now()) {
    question.status = "expired";
    await question.save();
    return res.status(400).json({ message: "This question has expired." });
  }

  const existingAttempt = await QuizAttempt.findOne({
    question: question._id,
    student: req.user._id
  });

  if (existingAttempt) {
    return res.status(409).json({ message: "You have already answered this question." });
  }

  const isCorrect = question.answer.trim() === selectedOption.trim();
  const attempt = await QuizAttempt.create({
    lecture: question.lecture,
    question: question._id,
    student: req.user._id,
    selectedOption: selectedOption.trim(),
    isCorrect,
    scoreAwarded: isCorrect ? 1 : 0
  });

  emitScoreboardUpdated(String(question.lecture), {
    lectureId: String(question.lecture),
    studentId: String(req.user._id)
  });

  res.json({
    attempt,
    result: {
      isCorrect,
      correctAnswer: question.answer
    }
  });
};

export const getScoreboard = async (req, res) => {
  if (req.user.role === "teacher") {
    const { lectureId } = req.query;
    if (!lectureId) {
      return res.status(400).json({ message: "lectureId is required." });
    }

    const lecture = await Lecture.findById(lectureId);
    if (!lecture) {
      return res.status(404).json({ message: "Lecture not found." });
    }

    if (String(lecture.uploadedBy) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only the session owner can view this scoreboard." });
    }

    const leaderboard = await buildTeacherLeaderboard(lecture);
    return res.json({ leaderboard });
  }

  const enrollments = await SessionEnrollment.find({ student: req.user._id }).populate("lecture", "title").lean();
  const lectureIds = enrollments.map((enrollment) => enrollment.lecture?._id).filter(Boolean);
  const questionsByLecture = await Question.aggregate([
    { $match: { lecture: { $in: lectureIds } } },
    {
      $group: {
        _id: "$lecture",
        total: { $sum: 1 }
      }
    }
  ]);
  const attemptsByLecture = await QuizAttempt.aggregate([
    {
      $match: {
        lecture: { $in: lectureIds },
        student: req.user._id
      }
    },
    {
      $group: {
        _id: "$lecture",
        correct: {
          $sum: {
            $cond: ["$isCorrect", 1, 0]
          }
        },
        wrong: {
          $sum: {
            $cond: ["$isCorrect", 0, 1]
          }
        },
        answered: { $sum: 1 }
      }
    }
  ]);

  const questionMap = new Map(questionsByLecture.map((row) => [String(row._id), row.total]));
  const attemptMap = new Map(attemptsByLecture.map((row) => [String(row._id), row]));

  const sessionRows = enrollments.map((enrollment) => {
    const lectureId = String(enrollment.lecture?._id);
    const attempts = attemptMap.get(lectureId) || { correct: 0, wrong: 0, answered: 0 };
    const total = questionMap.get(lectureId) || 0;

    return {
      lectureId,
      sessionName: enrollment.lecture?.title || "Unknown session",
      correctlyAnswered: attempts.correct,
      wronglyAnswered: attempts.wrong,
      unattempted: Math.max(0, total - attempts.answered)
    };
  });

  return res.json({ sessionRows });
};

export const getTeacherScoreboards = async (req, res) => {
  const lectures = await Lecture.find({ uploadedBy: req.user._id }).sort({ createdAt: -1 });
  const scoreboards = [];

  for (const lecture of lectures) {
    scoreboards.push({
      lectureId: lecture._id,
      lectureTitle: lecture.title,
      joinCode: lecture.joinCode,
      status: lecture.status,
      leaderboard: await buildTeacherLeaderboard(lecture)
    });
  }

  res.json({ scoreboards });
};

export const getCurrentJoinedLecture = async (req, res) => {
  const enrollment = await SessionEnrollment.findOne({
    student: req.user._id,
    status: "active"
  }).populate("lecture");

  if (!enrollment?.lecture) {
    return res.json({ lecture: null });
  }

  res.json({
    lecture: {
      _id: enrollment.lecture._id,
      title: enrollment.lecture.title,
      status: enrollment.lecture.status,
      intervalMinutes: enrollment.lecture.intervalMinutes
    }
  });
};
