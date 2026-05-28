import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    lecture: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lecture",
      required: true
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    question: {
      type: String,
      required: true,
      trim: true
    },
    options: {
      type: [String],
      validate: {
        validator: (options) => Array.isArray(options) && options.length === 4,
        message: "MCQ questions must contain exactly 4 options."
      },
      required: true
    },
    answer: {
      type: String,
      required: true
    },
    retrievedChunks: {
      type: [String],
      default: []
    },
    retrievalKeywords: {
      type: [String],
      default: []
    },
    sourceTranscript: {
      type: String,
      default: ""
    },
    intervalStartedAt: Date,
    intervalEndedAt: Date,
    expiresAt: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ["active", "expired"],
      default: "active"
    }
  },
  { timestamps: true }
);

export const Question = mongoose.model("Question", questionSchema);
