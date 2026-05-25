import { Router } from "express";
import {
  changeApplicationStatus,
  checkApplicationEligibility,
  createApplication,
  listMyApplications,
} from "../controllers/ApplicationController.js";

const router = Router();

router.post("/check-eligibility", checkApplicationEligibility);
router.post("/", createApplication);
router.get("/my", listMyApplications);
router.patch("/:id/status", changeApplicationStatus);

export default router;
