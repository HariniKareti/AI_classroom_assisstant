import mongoose from "mongoose";

const intervalWindowSchema = new mongoose.Schema(
  {
    windowId: {
      type: String,
      required: true
    },
    transcript: {
      type: String,
      required: true
    },
    suggestedKeywords: {
      type: [String],
      default: []
    },
    selectedKeywords: {
      type: [String],
      default: []
    },
    generatedQuestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      default: null
    },
    status: {
      type: String,
      enum: ["pending", "generated", "skipped"],
      default: "pending"
    },
    startedAt: Date,
    endedAt: Date,
    processedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const lectureMaterialSchema = new mongoose.Schema(
  {
    fileName: String,
    contentType: {
      type: String,
      default: "application/pdf"
    },
    rawText: {
      type: String,
      default: ""
    },
    chunksCount: {
      type: Number,
      default: 0
    },
    vectorCollection: {
      type: String,
      default: ""
    },
    uploadedAt: Date
  },
  { _id: false }
);

const lectureSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    joinCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    intervalMinutes: {
      type: Number,
      enum: [1, 2, 3, 4, 5],
      default: 1
    },
    status: {
      type: String,
      enum: ["ingesting", "ready", "active", "completed"],
      default: "ingesting"
    },
    currentWindowTranscript: {
      type: String,
      default: ""
    },
    lastProcessedTranscript: {
      type: String,
      default: ""
    },
    windows: {
      type: [intervalWindowSchema],
      default: []
    },
    startedAt: Date,
    endedAt: Date,
    material: {
      type: lectureMaterialSchema,
      default: () => ({
        fileName: "",
        contentType: "application/pdf",
        rawText: "",
        chunksCount: 0,
        vectorCollection: "",
        uploadedAt: null
      })
    },
    lastGeneratedAt: Date,
    activeQuestion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      default: null
    },
    metrics: {
      questionsGenerated: {
        type: Number,
        default: 0
      },
      generationRuns: {
        type: Number,
        default: 0
      }
    }
  },
  { timestamps: true }
);

export const Lecture = mongoose.model("Lecture", lectureSchema);
