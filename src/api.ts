export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(url: string, options: RequestInit & { timeout?: number } = {}) {
  const { timeout = 60000, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const isFormData = fetchOptions.body instanceof FormData;
  
  try {
    const response = await fetch(url, {
      credentials: "include",
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(fetchOptions.headers ?? {})
      }
    });

    clearTimeout(id);

    if (!response.ok) {
      let message = "Request failed";
      const textBody = await response.text();
      try {
        if (textBody) {
          const json = JSON.parse(textBody) as { error?: string };
          message = json.error ?? textBody;
        }
      } catch {
        message = textBody || message;
      }
      throw new ApiError(message, response.status);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return undefined as T;
    }
    return (await response.json()) as T;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error("Request timed out (60s). The server took too long to respond.");
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}
