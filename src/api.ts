export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(url: string, options: RequestInit = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const json = (await response.json()) as { error?: string };
      message = json.error ?? message;
    } catch {
      message = await response.text();
    }
    throw new ApiError(message, response.status);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
