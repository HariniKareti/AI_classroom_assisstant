import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createLecture,
  deleteLecture,
  generateQuestionFromWindow,
  getLectures,
  joinLecture,
  startLecture,
  endLecture,
  processIntervalTranscript,
} from "../controllers/lectureController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", protect, asyncHandler(getLectures));
router.post("/", protect, authorizeRoles("teacher"), upload.single("file"), asyncHandler(createLecture));
router.post("/join", protect, authorizeRoles("student"), asyncHandler(joinLecture));
router.post("/:lectureId/start", protect, authorizeRoles("teacher"), asyncHandler(startLecture));
router.post("/:lectureId/end", protect, authorizeRoles("teacher"), asyncHandler(endLecture));
router.post("/:lectureId/interval", protect, authorizeRoles("teacher"), asyncHandler(processIntervalTranscript));
router.post("/:lectureId/interval/:windowId/generate", protect, authorizeRoles("teacher"), asyncHandler(generateQuestionFromWindow));
router.delete("/:lectureId", protect, authorizeRoles("teacher"), asyncHandler(deleteLecture));

export default router;
