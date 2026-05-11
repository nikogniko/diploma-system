import { Router } from "express";
import { completeOnboarding } from "../controllers/user.controller.js";

const router = Router();

router.post("/onboarding", completeOnboarding);

export default router;
