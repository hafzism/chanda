interface ApiErrorBody {
  message?: string | string[];
}

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (Array.isArray(body.message)) return body.message.join(' ');
    if (body.message) return body.message;
  } catch {
    // The fallback below is deliberately response-format agnostic.
  }
  return 'Unable to complete the request.';
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const contentTypeHeader =
    typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {};
  const hasHeaders = Object.keys(contentTypeHeader).length > 0 || init.headers;
  const requestInit: RequestInit = {
    ...init,
    ...(hasHeaders
      ? { headers: { ...contentTypeHeader, ...init.headers } }
      : {}),
  };
  const url = `/api/v1${path}`;
  const response = await (Object.keys(requestInit).length > 0
    ? fetch(url, requestInit)
    : fetch(url));

  if (!response.ok) {
    throw new ApiRequestError(await readApiError(response), response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
