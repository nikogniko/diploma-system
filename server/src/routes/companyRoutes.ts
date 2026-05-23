import { Router } from "express";
import {
  getPublicCompany,
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
router.get("/:companyId", getPublicCompany);

export default router;
