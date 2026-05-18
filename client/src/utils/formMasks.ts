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
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
