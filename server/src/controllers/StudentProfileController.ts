import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { BusinessLogicError, HttpStatus } from "../errors/BusinessLogicError.js";
import { studentProfileService } from "../services/StudentProfileService.js";

/** Витягує Clerk user id з авторизованого запиту. */
const requireClerkUserId = (req: Request) => {
  const { userId } = getAuth(req);

  if (!userId) {
    throw new BusinessLogicError(
      "Unauthorized. Clerk user id is missing.",
      HttpStatus.UNAUTHORIZED,
      "UNAUTHORIZED",
    );
  }

  return userId;
};

/** Повертає id з params як рядок. */
const param = (req: Request, name: string) => {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
};

/** Повертає профіль студента поточного користувача. */
export const getMyStudentProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await studentProfileService.getMyProfile(requireClerkUserId(req));
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Оновлює персональну інформацію студента. */
export const updateStudentPersonalInfo = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await studentProfileService.updateBaseData(
      requireClerkUserId(req),
      req.body,
    );
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Оновлює налаштування пошуку студента. */
export const updateStudentSearchPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await studentProfileService.updateSearchSettings(
      requireClerkUserId(req),
      req.body,
    );
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Повертає налаштування студента для персоналізованого пошуку вакансій. */
export const getStudentSearchPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await studentProfileService.getSearchPreferences(
      requireClerkUserId(req),
    );
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Створює запис освіти студента. */
export const createEducation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await studentProfileService.createEducation(
      requireClerkUserId(req),
      req.body,
    );
    res.status(HttpStatus.CREATED).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Оновлює запис освіти студента. */
export const updateEducation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await studentProfileService.updateEducation(
      requireClerkUserId(req),
      param(req, "educationId"),
      req.body,
    );
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Видаляє запис освіти студента. */
export const deleteEducation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await studentProfileService.deleteEducation(
      requireClerkUserId(req),
      param(req, "educationId"),
    );
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Створює або оновлює мовну навичку студента. */
export const upsertLanguageSkill = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await studentProfileService.upsertLanguageSkill(
      requireClerkUserId(req),
      req.body,
    );
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Оновлює мовну навичку студента. */
export const updateLanguageSkill = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await studentProfileService.updateLanguageSkill(
      requireClerkUserId(req),
      param(req, "languageSkillId"),
      req.body,
    );
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Видаляє мовну навичку студента. */
export const deleteLanguageSkill = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await studentProfileService.deleteLanguageSkill(
      requireClerkUserId(req),
      param(req, "languageSkillId"),
    );
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Створює курс студента. */
export const createCourse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await studentProfileService.createCourse(requireClerkUserId(req), req.body);
    res.status(HttpStatus.CREATED).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Оновлює курс студента. */
export const updateCourse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await studentProfileService.updateCourse(
      requireClerkUserId(req),
      param(req, "courseId"),
      req.body,
    );
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Видаляє курс студента. */
export const deleteCourse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await studentProfileService.deleteCourse(
      requireClerkUserId(req),
      param(req, "courseId"),
    );
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Створює проєкт студента. */
export const createProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await studentProfileService.createProject(requireClerkUserId(req), req.body);
    res.status(HttpStatus.CREATED).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Оновлює проєкт студента. */
export const updateProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await studentProfileService.updateProject(
      requireClerkUserId(req),
      param(req, "projectId"),
      req.body,
    );
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Видаляє проєкт студента. */
export const deleteProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await studentProfileService.deleteProject(
      requireClerkUserId(req),
      param(req, "projectId"),
    );
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Створює досвід роботи студента. */
export const createExperience = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await studentProfileService.createExperience(
      requireClerkUserId(req),
      req.body,
    );
    res.status(HttpStatus.CREATED).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Оновлює досвід роботи студента. */
export const updateExperience = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await studentProfileService.updateExperience(
      requireClerkUserId(req),
      param(req, "experienceId"),
      req.body,
    );
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Видаляє досвід роботи студента. */
export const deleteExperience = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await studentProfileService.deleteExperience(
      requireClerkUserId(req),
      param(req, "experienceId"),
    );
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
