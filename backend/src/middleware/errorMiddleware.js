import { logger } from "../utils/logger.js";

export const notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
};

export const errorHandler = (err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, path: req.originalUrl });
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode).json({
    message: err.message || "Internal server error."
  });
};
