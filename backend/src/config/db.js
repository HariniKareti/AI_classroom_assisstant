import mongoose from "mongoose";
import { env } from "./env.js";

export const connectDb = async () => {
  if (!env.mongoUri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  await mongoose.connect(env.mongoUri);
  console.log("MongoDB connected");
};
