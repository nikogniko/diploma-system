import { Router } from "express";
import {
  archiveVacancy,
  changeVacancyStatus,
  createVacancy,
  getMyVacancy,
  getVacancyCatalogs,
  listMyVacancies,
  updateVacancy,
} from "../controllers/VacancyController.js";

const router = Router();

router.get("/catalogs", getVacancyCatalogs);
router.get("/my-cabinet", listMyVacancies);
router.post("/my-cabinet", createVacancy);
router.get("/my-cabinet/:vacancyId", getMyVacancy);
router.patch("/my-cabinet/:vacancyId", updateVacancy);
router.patch("/my-cabinet/:vacancyId/status", changeVacancyStatus);
router.post("/my-cabinet/:vacancyId/archive", archiveVacancy);

export default router;
