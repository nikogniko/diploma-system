import { Router } from "express";
import {
  createCourse,
  createEducation,
  createExperience,
  createProject,
  deleteCourse,
  deleteEducation,
  deleteExperience,
  deleteLanguageSkill,
  deleteProject,
  getMyStudentProfile,
  getStudentSearchPreferences,
  updateStudentPersonalInfo,
  updateStudentSearchPreferences,
  updateCourse,
  updateEducation,
  updateExperience,
  updateLanguageSkill,
  updateProject,
  upsertLanguageSkill,
} from "../controllers/StudentProfileController.js";

const router = Router();

router.get("/my-cabinet", getMyStudentProfile);
router.get("/my-cabinet/search-preferences", getStudentSearchPreferences);
router.patch("/my-cabinet/personal-info", updateStudentPersonalInfo);
router.patch("/my-cabinet/search-preferences", updateStudentSearchPreferences);

router.post("/my-cabinet/resume/education", createEducation);
router.patch("/my-cabinet/resume/education/:educationId", updateEducation);
router.delete("/my-cabinet/resume/education/:educationId", deleteEducation);

router.post("/my-cabinet/resume/languages", upsertLanguageSkill);
router.patch("/my-cabinet/resume/languages/:languageSkillId", updateLanguageSkill);
router.delete("/my-cabinet/resume/languages/:languageSkillId", deleteLanguageSkill);

router.post("/my-cabinet/resume/courses", createCourse);
router.patch("/my-cabinet/resume/courses/:courseId", updateCourse);
router.delete("/my-cabinet/resume/courses/:courseId", deleteCourse);

router.post("/my-cabinet/resume/projects", createProject);
router.patch("/my-cabinet/resume/projects/:projectId", updateProject);
router.delete("/my-cabinet/resume/projects/:projectId", deleteProject);

router.post("/my-cabinet/resume/experiences", createExperience);
router.patch("/my-cabinet/resume/experiences/:experienceId", updateExperience);
router.delete("/my-cabinet/resume/experiences/:experienceId", deleteExperience);

export default router;
