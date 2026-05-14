import { Router } from "express";
import {
  getMyHrProfile,
  updateMyHrProfile,
} from "../controllers/HrProfileController.js";

const router = Router();

router.get("/my-cabinet", getMyHrProfile);
router.patch("/my-cabinet", updateMyHrProfile);

export default router;
