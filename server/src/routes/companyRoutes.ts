import { Router } from "express";
import {
  getMyCompany,
  getMyCompanyHrs,
  updateMyCompany,
} from "../controllers/CompanyController.js";

const router = Router();

router.get("/my-cabinet", getMyCompany);
router.patch("/my-cabinet", updateMyCompany);
router.get("/my-cabinet/hr-profiles", getMyCompanyHrs);
// TODO: додати /my-cabinet/vacancies після реалізації модуля вакансій.

export default router;
