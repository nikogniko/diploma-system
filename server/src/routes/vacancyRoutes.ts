import { Router } from "express";
import {
  archiveVacancy,
  changeVacancyStatus,
  createVacancy,
  getStudentVacancy,
  getStudentVacancyFilterOptions,
  getMyVacancy,
  getVacancyCatalogs,
  listStudentVacancies,
  listMyVacancies,
  updateVacancy,
} from "../controllers/VacancyController.js";

const router = Router();

router.get("/catalogs", getVacancyCatalogs);
router.get("/search", listStudentVacancies);
router.get("/student", listStudentVacancies);
router.get("/student/filter-options", getStudentVacancyFilterOptions);
router.get("/student/:vacancyId", getStudentVacancy);
router.get("/my-cabinet", listMyVacancies);
router.post("/my-cabinet", createVacancy);
router.get("/my-cabinet/:vacancyId", getMyVacancy);
router.patch("/my-cabinet/:vacancyId", updateVacancy);
router.patch("/my-cabinet/:vacancyId/status", changeVacancyStatus);
router.post("/my-cabinet/:vacancyId/archive", archiveVacancy);

export default router;
