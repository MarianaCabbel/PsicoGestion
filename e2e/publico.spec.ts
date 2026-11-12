import { expect, test } from '@playwright/test';

/**
 * Humo público: no requiere credenciales.
 * Cubre que el frontend responda y que el acceso muestre sus campos.
 */
test.describe('Acceso público', () => {
  test('la raíz redirige al inicio de sesión', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Bienvenida, bienvenido' })).toBeVisible();
  });

  test('el inicio de sesión muestra correo, contraseña y enlace de recuperación', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Correo institucional')).toBeVisible();
    await expect(page.getByLabel('Contraseña')).toBeVisible();
    await expect(page.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toBeVisible();
  });

  test('@perf el inicio de sesión carga dentro del presupuesto', async ({ page }) => {
    const presupuesto = Number(process.env.E2E_PERF_BUDGET_MS ?? 5_000);
    const inicio = Date.now();
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Bienvenida, bienvenido' })).toBeVisible();
    const duracion = Date.now() - inicio;

    test.info().annotations.push({
      type: 'rendimiento',
      description: `/login visible en ${duracion} ms (presupuesto ${presupuesto} ms)`,
    });
    expect(
      duracion,
      `/login tardó ${duracion} ms y el presupuesto es ${presupuesto} ms`,
    ).toBeLessThan(presupuesto);
  });
});
