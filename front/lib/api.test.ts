import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('sends JSON requests with cookie credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, message: 'ok', data: { id: 8 } }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await api<{ id: number }>('/api/auth/me', {
      method: 'POST',
      body: { hello: 'world' },
    });

    expect(result.data.id).toBe(8);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/auth\/me$/),
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
        body: JSON.stringify({ hello: 'world' }),
      }),
    );
  });

  it('preserves multipart form data without setting a JSON content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, message: 'ok', data: null }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const formData = new FormData();
    formData.append('foto', new Blob(['photo']), 'photo.png');

    await api('/api/terapeutas/1/foto', { method: 'PUT', body: formData });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(request?.credentials).toBe('include');
    expect(request?.body).toBe(formData);
    expect(new Headers(request?.headers).has('Content-Type')).toBe(false);
  });

  it('raises ApiError with the server message and status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'No autorizado' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(api('/api/auth/registro', { method: 'POST', body: {} })).rejects.toMatchObject({
      name: 'ApiError',
      message: 'No autorizado',
      status: 403,
    } satisfies Partial<ApiError>);
  });

  it('redirects to login after an unauthorized response by default', async () => {
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { pathname: '/panel', assign } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    await expect(api('/api/pacientes')).rejects.toBeInstanceOf(ApiError);
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('allows session checks to handle 401 without redirecting', async () => {
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { pathname: '/panel', assign } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    await expect(api('/api/auth/me', { redirectOnUnauthorized: false })).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(assign).not.toHaveBeenCalled();
  });

  it('convierte una caída de red en un ApiError accionable con estado 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(api('/api/salas')).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      message: expect.stringMatching(/No se pudo conectar con el servidor/),
    });
  });

  it('deja intacta una petición abortada', async () => {
    const abort = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));

    await expect(
      api('/api/salas', { signal: new AbortController().signal }),
    ).rejects.toBe(abort);
  });
});
