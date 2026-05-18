import { Router } from "express";
import {
  completeOnboarding,
  getMyAuthSnapshot,
  getPublicUserInfo,
  handleClerkWebhook,
  updateMyEmail,
  updateUserStatus,
} from "../controllers/UserController.js";

const router = Router();

router.post("/webhooks/clerk", handleClerkWebhook);
router.post("/onboarding", completeOnboarding);
router.get("/my-cabinet/auth", getMyAuthSnapshot);
router.patch("/my-cabinet/email", updateMyEmail);
router.get("/:userId/public-info", getPublicUserInfo);
router.patch("/:userId/status", updateUserStatus);

export default router;
