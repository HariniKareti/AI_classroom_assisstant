import mongoose from "mongoose";

const quizAttemptSchema = new mongoose.Schema(
  {
    lecture: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lecture",
      required: true
    },
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    selectedOption: {
      type: String,
      required: true
    },
    isCorrect: {
      type: Boolean,
      required: true
    },
    scoreAwarded: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

quizAttemptSchema.index({ question: 1, student: 1 }, { unique: true });

export const QuizAttempt = mongoose.model("QuizAttempt", quizAttemptSchema);
