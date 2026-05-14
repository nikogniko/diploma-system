import { Router } from "express";
import {
  completeOnboarding,
  getPublicUserInfo,
  handleClerkWebhook,
  updateMyEmail,
  updateUserStatus,
} from "../controllers/UserController.js";

const router = Router();

router.post("/webhooks/clerk", handleClerkWebhook);
router.post("/onboarding", completeOnboarding);
router.patch("/my-cabinet/email", updateMyEmail);
router.get("/:userId/public-info", getPublicUserInfo);
router.patch("/:userId/status", updateUserStatus);

export default router;
