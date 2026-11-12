export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  redirectOnUnauthorized?: boolean;
};

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(
  /\/$/,
  '',
);

function errorMessage(payload: unknown, status: number): string {
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const { message } = payload;
    if (typeof message === 'string' && message.trim()) return message;
  }

  return `La solicitud falló (HTTP ${status}).`;
}

const NETWORK_ERROR_MESSAGE =
  'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';

function fueAbortada(cause: unknown): boolean {
  return cause instanceof Error && cause.name === 'AbortError';
}

/** Envuelve fetch para convertir una caída de red en un ApiError con mensaje accionable. */
async function pedir(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (cause) {
    // Quien canceló la petición espera distinguirla: no la convertimos en ApiError.
    if (fueAbortada(cause)) throw cause;
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
  }
}

export async function api<T>(
  path: string,
  { body, headers, redirectOnUnauthorized = true, ...options }: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
  const requestHeaders = new Headers(headers);
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isFormData && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  const response = await pedir(`${API_BASE_URL}${path}`, {
    ...options,
    headers: requestHeaders,
    credentials: 'include',
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  let payload: unknown = null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    payload = await response.json();
  }

  if (!response.ok) {
    if (
      response.status === 401 &&
      redirectOnUnauthorized &&
      typeof window !== 'undefined' &&
      window.location.pathname !== '/login'
    ) {
      window.location.assign('/login');
    }

    throw new ApiError(errorMessage(payload, response.status), response.status, payload);
  }

  return payload as ApiResponse<T>;
}

export async function apiBlob(path: string, options: RequestInit = {}) {
  const response = await pedir(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? '';
    const payload: unknown = contentType.includes('application/json')
      ? await response.json()
      : null;
    if (
      response.status === 401 &&
      typeof window !== 'undefined' &&
      window.location.pathname !== '/login'
    ) {
      window.location.assign('/login');
    }
    throw new ApiError(errorMessage(payload, response.status), response.status, payload);
  }

  return response.blob();
}
