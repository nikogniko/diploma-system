export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

/** Виконує HTTP-запит до backend API та нормалізує помилки для інтерфейсу. */
export async function apiRequest<T>(
  path: string,
  token: string | null,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Сервер тимчасово недоступний. Перевірте, чи запущений backend.",
      0,
      "NETWORK_ERROR",
    );
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(
      error?.message ?? "Сталася помилка під час запиту",
      response.status,
      error?.code,
      error?.details,
    );
  }

  return payload?.data as T;
}
