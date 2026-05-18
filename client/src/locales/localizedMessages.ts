import uk from "./uk.json";

type Messages = typeof uk;

export const messages: Messages = uk;

/** Підставляє прості {{placeholders}} у локалізований рядок. */
export function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
    template,
  );
}
