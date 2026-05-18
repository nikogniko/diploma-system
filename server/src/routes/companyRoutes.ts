import { Router } from "express";
import {
  getMyCompany,
  getMyCompanyHrs,
  searchCompanies,
  updateMyCompany,
} from "../controllers/CompanyController.js";

const router = Router();

router.get("/", searchCompanies);
router.get("/my-cabinet", getMyCompany);
router.patch("/my-cabinet", updateMyCompany);
router.get("/my-cabinet/hr-profiles", getMyCompanyHrs);
// TODO: додати /my-cabinet/vacancies після реалізації модуля вакансій.

export default router;
