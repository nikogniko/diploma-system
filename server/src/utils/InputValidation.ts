import { BusinessLogicError, HttpStatus } from "../errors/BusinessLogicError.js";

export const validationLimits = {
  userName: 100,
  userPhotoUrl: 255,
  email: 255,
  phone: 50,
  studentAbout: 500,
  studentLinks: 10,
  linkName: 100,
  linkValue: 255,
  desiredPosition: 150,
  desiredProfessions: 5,
  preferenceOptions: 10,
  desiredLocations: 5,
  monthlySalary: 1_000_000,
  hourlySalary: 10_000,
  educationName: 200,
  educationSpecialty: 200,
  resourceUrl: 255,
  courseTitle: 200,
  courseSkills: 20,
  resumeTitle: 200,
  resumeRichText: 10_000,
  resumeSkills: 30,
  companyRegistrationNumber: 50,
  companyLegalName: 200,
  companyDomain: 100,
  companyPublicName: 100,
  companyAbout: 10_000,
  companyLinks: 10,
  vacancyTitle: 200,
  vacancyDescription: 10_000,
  vacancySkills: 30,
  vacancyLanguages: 5,
  vacancyLocations: 10,
  applicationCoverLetter: 5_000,
} as const;

const domainPattern =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export function requireText(value: unknown, fieldName: string, maxLength?: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throwValidation(`${fieldName} is required`, "REQUIRED_FIELD_MISSING", { fieldName });
  }

  return ensureMaxLength(value.trim(), fieldName, maxLength);
}

export function optionalText(
  value: unknown,
  fieldName: string,
  maxLength?: number,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throwValidation(`${fieldName} must be a string`, "INVALID_STRING", { fieldName });
  }

  const normalized = value.trim();
  if (!normalized) return null;
  return ensureMaxLength(normalized, fieldName, maxLength);
}

export function ensureMaxLength(value: string, fieldName: string, maxLength?: number): string {
  if (maxLength && value.length > maxLength) {
    throwValidation(
      `${fieldName} must be at most ${maxLength} characters`,
      "FIELD_TOO_LONG",
      { fieldName, maxLength },
    );
  }

  return value;
}

export function requireNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throwValidation(`${fieldName} must be a valid number`, "INVALID_NUMBER", { fieldName });
  }

  return value;
}

export function requireInteger(value: unknown, fieldName: string): number {
  const numberValue = requireNumber(value, fieldName);
  if (!Number.isInteger(numberValue)) {
    throwValidation(`${fieldName} must be an integer`, "INVALID_NUMBER", { fieldName });
  }

  return numberValue;
}

export function ensureRange(
  value: number,
  fieldName: string,
  min: number,
  max: number,
): number {
  if (value < min || value > max) {
    throwValidation(
      `${fieldName} must be between ${min} and ${max}`,
      "NUMBER_OUT_OF_RANGE",
      { fieldName, min, max },
    );
  }

  return value;
}

export function normalizeEmail(value: string, fieldName = "email"): string {
  ensureMaxLength(value, fieldName, validationLimits.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throwValidation(`${fieldName} must be a valid email`, "INVALID_EMAIL", { fieldName });
  }

  return value;
}

export function optionalUrl(
  value: unknown,
  fieldName: string,
  maxLength = validationLimits.resourceUrl,
): string | null {
  const normalized = optionalText(value, fieldName, maxLength);
  if (normalized) ensureHttpUrl(normalized, fieldName);
  return normalized;
}

export function requireUrl(
  value: unknown,
  fieldName: string,
  maxLength = validationLimits.resourceUrl,
): string {
  const normalized = requireText(value, fieldName, maxLength);
  ensureHttpUrl(normalized, fieldName);
  return normalized;
}

export function optionalDomain(value: unknown, fieldName: string, maxLength: number): string | null {
  const normalized = optionalText(value, fieldName, maxLength);
  if (!normalized) return null;
  if (normalized.includes("://") || !domainPattern.test(normalized)) {
    throwValidation(`${fieldName} must be a valid domain`, "INVALID_DOMAIN", { fieldName });
  }

  return normalized.toLowerCase();
}

export function ensureHttpUrl(value: string, fieldName: string): void {
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;

  try {
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
      throw new Error("Unsupported URL");
    }
  } catch {
    throwValidation(`${fieldName} must be a valid URL`, "INVALID_URL", { fieldName });
  }
}

export function ensureArrayLength<T>(
  values: T[],
  fieldName: string,
  min: number,
  max: number,
): T[] {
  if (values.length < min || values.length > max) {
    throwValidation(
      `${fieldName} must contain between ${min} and ${max} items`,
      "INVALID_ITEMS_COUNT",
      { fieldName, min, max },
    );
  }

  return values;
}

export function ensureDateOrder(startDate: Date, endDate: Date | null, fieldName = "endDate") {
  if (endDate && endDate < startDate) {
    throwValidation(`${fieldName} cannot be earlier than startDate`, "INVALID_DATE_RANGE", {
      fieldName,
    });
  }
}

export function ensureYearRange(startYear: number, endYear: number | null, fieldName = "year") {
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 80;
  const maxYear = currentYear + 10;

  ensureRange(startYear, "startYear", minYear, maxYear);
  if (endYear !== null) {
    ensureRange(endYear, "endYear", minYear, maxYear);
    if (endYear < startYear) {
      throwValidation("endYear cannot be earlier than startYear", "INVALID_YEAR_RANGE", {
        fieldName,
      });
    }
  }
}

function throwValidation(message: string, code: string, details?: unknown): never {
  throw new BusinessLogicError(message, HttpStatus.BAD_REQUEST, code, details);
}
