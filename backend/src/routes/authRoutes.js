import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getMe, login, logout, signup } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/signup", asyncHandler(signup));
router.post("/login", asyncHandler(login));
router.post("/logout", protect, asyncHandler(logout));
router.get("/me", protect, asyncHandler(getMe));

export default router;
