const DIGITS_ONLY = /\D/g;

/** Форматує український номер телефону у вигляд +380 XX XXX XX XX. */
export function formatUkrainianPhone(value: string) {
  const digits = value.replace(DIGITS_ONLY, "").replace(/^380/, "").replace(/^0/, "").slice(0, 9);
  if (!digits) return "";
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean);
  return `+380${parts.length ? ` ${parts.join(" ")}` : ""}`;
}

/** Перевіряє, що телефон заповнений повністю у форматі +380 XX XXX XX XX. */
export function isValidUkrainianPhone(value: string) {
  return /^\+380\s\d{2}\s\d{3}\s\d{2}\s\d{2}$/.test(value.trim());
}

/** Перевіряє базовий формат email без бізнес-обмежень на домен. */
export function isValidEmail(value: string) {
  return /^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value.trim());
}

/** Обмежує email латиницею, цифрами та базовими службовими символами адреси. */
export function sanitizeEmailInput(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._+-@]/g, "").slice(0, 254);
}

/** Обмежує ПІБ літерами, пробілами, дефісом та апострофом. */
export function sanitizeNameInput(value: string) {
  return value.replace(/[^\p{L}' -]/gu, "").slice(0, 100);
}

/** Обмежує назву посади символами, які природно трапляються в назвах ролей. */
export function sanitizePositionInput(value: string) {
  return value.replace(/[^\p{L}\p{N}'’ .,+/&-]/gu, "").slice(0, 150);
}

/** Обмежує домен латиницею, цифрами, крапками та дефісами. */
export function sanitizeDomainInput(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.-]/g, "").replace(/\.{2,}/g, ".").slice(0, 100);
}

/** Обрізає реєстраційний номер до довжини, потрібної для типу компанії. */
export function sanitizeRegistrationNumber(value: string, registrationType: string) {
  return value.replace(DIGITS_ONLY, "").slice(0, registrationType === "FOP" ? 10 : 8);
}
