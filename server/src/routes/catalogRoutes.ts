import { Router } from "express";
import {
  getStudentCabinetCatalogs,
  searchCities,
  searchCountries,
  searchProfessions,
  searchRegions,
  searchSkills,
  searchSpheres,
  searchUniversities,
} from "../controllers/CatalogController.js";

const router = Router();

router.get("/student-cabinet", getStudentCabinetCatalogs);
router.get("/skills", searchSkills);
router.get("/universities", searchUniversities);
router.get("/professions", searchProfessions);
router.get("/spheres", searchSpheres);
router.get("/countries", searchCountries);
router.get("/countries/:countryId/regions", searchRegions);
router.get("/regions/:regionId/cities", searchCities);

export default router;
