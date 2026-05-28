import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getCurrentJoinedLecture,
  getScoreboard,
  getTeacherScoreboards,
  listQuestions,
  submitAnswer
} from "../controllers/questionController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = Router();

router.get("/", protect, asyncHandler(listQuestions));
router.get("/scoreboard", protect, asyncHandler(getScoreboard));
router.get("/teacher-scoreboards", protect, authorizeRoles("teacher"), asyncHandler(getTeacherScoreboards));
router.get("/current-session", protect, authorizeRoles("student"), asyncHandler(getCurrentJoinedLecture));
router.post("/submit", protect, authorizeRoles("student"), asyncHandler(submitAnswer));

export default router;
