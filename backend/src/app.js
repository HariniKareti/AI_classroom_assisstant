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
  // Debug: log every incoming request with method, path, and origin
  app.use((req, res, next) => {
    // eslint-disable-next-line no-console
    console.log(`[DEBUG] ${req.method} ${req.path} Origin: ${req.headers.origin || 'N/A'}`);
    next();
  });
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        const normalizedOrigin = origin.replace(/\/+$/, "");
        if (env.clientOrigins.includes(normalizedOrigin)) {
          callback(null, true);
          return;
        }

        try {
          const { hostname, port } = new URL(normalizedOrigin);
          const isGithubPreviewHost = hostname.endsWith(".app.github.dev");
          const isLocalDevHost = ["localhost", "127.0.0.1"].includes(hostname) && ["4173", "5173", ""].includes(port);

          if (isGithubPreviewHost || isLocalDevHost) {
            callback(null, true);
            return;
          }
        } catch (error) {
          // ignore invalid origin parsing and reject below
        }

        callback(new Error("Not allowed by CORS"));
      },
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
