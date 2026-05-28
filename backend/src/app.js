import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes.js";
import lectureRoutes from "./routes/lectureRoutes.js";
import questionRoutes from "./routes/questionRoutes.js";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan("dev"));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      standardHeaders: true
    })
  );

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/lecture", lectureRoutes);
  app.use("/api/questions", questionRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
};
