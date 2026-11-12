import { expect, test, type Page } from '@playwright/test';

/**
 * Flujos autenticados de salas y citas.
 *
 * Se omiten si no se configuran credenciales:
 *   E2E_EMAIL=usuario@uady.mx E2E_PASSWORD=... npm run test:e2e
 */
const EMAIL = process.env.E2E_EMAIL?.trim();
const PASSWORD = process.env.E2E_PASSWORD;

async function iniciarSesion(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Correo institucional').fill(EMAIL!);
  await page.getByLabel('Contraseña').fill(PASSWORD!);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/panel$/, { timeout: 20_000 });
}

test.describe('Salas y citas', () => {
  test.skip(
    !EMAIL || !PASSWORD,
    'Define E2E_EMAIL y E2E_PASSWORD para ejecutar los flujos autenticados.',
  );

  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page);
  });

  test('crea, edita y da de baja una sala', async ({ page }) => {
    test.slow();
    const sufijo = Date.now().toString().slice(-6);
    const nombre = `E2E${sufijo}`;
    const nombreEditado = `E2F${sufijo}`;

    await page.goto('/salas');
    await expect(page.getByRole('heading', { name: 'Salas', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Nueva sala' }).click();
    const alta = page.getByRole('dialog', { name: 'Registrar sala' });
    await alta.getByLabel('Nombre de sala').fill(nombre);
    await alta.getByRole('button', { name: 'Crear sala' }).click();

    const fila = page.getByRole('row').filter({ hasText: nombre });
    await expect(fila).toBeVisible();

    await fila.getByRole('button', { name: `Acciones para ${nombre}` }).click();
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    const edicion = page.getByRole('dialog', { name: 'Editar sala' });
    await expect(edicion.getByLabel('Nombre de sala')).toHaveValue(nombre);
    await edicion.getByLabel('Nombre de sala').fill(nombreEditado);
    await edicion.getByRole('button', { name: 'Guardar cambios' }).click();

    const editada = page.getByRole('row').filter({ hasText: nombreEditado });
    await expect(editada).toBeVisible();

    await editada.getByRole('button', { name: `Acciones para ${nombreEditado}` }).click();
    await page.getByRole('menuitem', { name: 'Dar de baja' }).click();
    const baja = page.getByRole('dialog', { name: 'Dar de baja la sala' });
    await baja.getByRole('button', { name: 'Confirmar baja' }).click();
    await expect(editada).toHaveCount(0);
  });

  test('la disponibilidad diaria distingue libre de reservada', async ({ page }) => {
    await page.goto('/salas');
    const dia = page.locator('.room-day-card').first();
    await expect(dia).toBeVisible();
    await expect(dia.getByText(/^(Libre|Reservada)$/)).toBeVisible();
  });

  test('un enlace directo a un folio inexistente explica el problema', async ({ page }) => {
    await page.goto('/citas?folio=CIT-2026-999999');
    await expect(page.getByRole('alert')).toContainText('No existe una cita con ese folio.');
    await expect(page.getByLabel('Buscar folio')).toHaveValue('CIT-2026-999999');
  });
});
