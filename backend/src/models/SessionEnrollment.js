import mongoose from "mongoose";

const sessionEnrollmentSchema = new mongoose.Schema(
  {
    lecture: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lecture",
      required: true
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    status: {
      type: String,
      enum: ["active", "left"],
      default: "active"
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

sessionEnrollmentSchema.index({ lecture: 1, student: 1 }, { unique: true });

export const SessionEnrollment = mongoose.model("SessionEnrollment", sessionEnrollmentSchema);
