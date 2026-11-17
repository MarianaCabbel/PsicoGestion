import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * CP4-INT: agenda, impresión, panel y navegación.
 *
 * Requiere el manifiesto generado por `npm run seed:e2e`. Antes de la suite se
 * vuelve a ejecutar el seed para dejar los datos E2E en su estado inicial; usa
 * `E2E_SKIP_SEED=1` para conservarlos.
 */
type SeedData = {
  email: string;
  password: string;
  dates: {
    hoy: string;
    simultaneas: string;
    muchas: string;
    vencida: string;
    libre: string;
  };
  folios: {
    simultanea: string[];
    ultimoLapso: string;
    muchas: string[];
    vencida: string;
  };
};

const SEED_PATH = path.join(process.cwd(), 'e2e', 'seed-data.json');
const MANIFIESTO_INICIAL = cargarManifiesto();
let seed: SeedData | null = MANIFIESTO_INICIAL;

const EMAIL = process.env.E2E_EMAIL?.trim() || MANIFIESTO_INICIAL?.email;
const PASSWORD = process.env.E2E_PASSWORD || MANIFIESTO_INICIAL?.password;

function cargarManifiesto(): SeedData | null {
  if (!fs.existsSync(SEED_PATH)) return null;
  return JSON.parse(fs.readFileSync(SEED_PATH, 'utf8')) as SeedData;
}

function assertSeed(): SeedData {
  if (!seed) throw new Error('Falta e2e/seed-data.json. Ejecuta `npm run seed:e2e`.');
  return seed;
}

async function iniciarSesion(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Correo institucional').fill(EMAIL!);
  await page.getByLabel('Contraseña').fill(PASSWORD!);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/panel$/, { timeout: 20_000 });
}

function esperarRespuestaDeAgenda(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.url().includes('/api/agenda?') && response.request().method() === 'GET',
  );
}

async function accionConAgenda(page: Page, accion: () => Promise<void>) {
  const respuesta = esperarRespuestaDeAgenda(page);
  await accion();
  await respuesta;
  await expect(page.locator('.agenda-loading')).toHaveCount(0);
}

async function abrirAgenda(page: Page, fecha: string, vista: 'Día' | 'Semana' | 'Mes') {
  await page.goto('/agenda');
  await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
  await expect(page.locator('.agenda-loading')).toHaveCount(0);

  const formulario = page.locator('form.agenda-date-form');
  await accionConAgenda(page, async () => {
    await formulario.getByLabel('Ir a fecha').fill(fecha);
    await formulario.getByRole('button', { name: 'Ir', exact: true }).click();
  });

  const botonVista = page.getByRole('button', { name: vista, exact: true });
  if ((await botonVista.getAttribute('aria-pressed')) !== 'true') {
    await accionConAgenda(page, () => botonVista.click());
  }

  await expect(page.locator('input[name="fecha"]')).toHaveValue(fecha);
}

function contarCitas(texto: string | null) {
  return Number(texto?.match(/(\d+) cita/)?.[1] ?? -1);
}

function diasDelMes(fecha: string) {
  const [anio, mes] = fecha.split('-').map(Number);
  return new Date(anio, mes, 0).getDate();
}

/** Citas creadas por el seed (folio E2E-…), sin mezclar datos reales de la agenda. */
function citasE2E(page: Page) {
  return page.locator('.agenda-appointment[aria-label^="Cita E2E-"]');
}

function diaDelMes(page: Page, fecha: string, total: number) {
  return page.getByRole('button', {
    name: new RegExp(`^${Number(fecha.slice(-2))} ${total} citas$`),
  });
}

test.describe('Agenda CP4-INT', () => {
  test.skip(
    !MANIFIESTO_INICIAL,
    'Ejecuta `npm run seed:e2e` para generar e2e/seed-data.json y los datos de prueba.',
  );

  test.beforeAll(() => {
    if (!MANIFIESTO_INICIAL || process.env.E2E_SKIP_SEED === '1') return;
    execFileSync(process.execPath, [path.join(process.cwd(), 'scripts', 'seed-e2e.js')], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'pipe',
    });
    seed = cargarManifiesto();
  });

  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page);
  });

  test('CP4-INT-01/03/04/05/15 muestra citas y navega entre día, semana y mes', async ({
    page,
  }) => {
    const datos = assertSeed().dates;

    await abrirAgenda(page, datos.simultaneas, 'Día');
    await expect(page.locator('.agenda-grid-day')).toBeVisible();
    await expect(citasE2E(page)).toHaveCount(4);

    await accionConAgenda(page, () =>
      page.getByRole('button', { name: 'Semana', exact: true }).click(),
    );
    await expect(page.locator('.agenda-grid-week')).toBeVisible();
    await expect(page.locator('.agenda-day-heading')).toHaveCount(7);
    await expect(citasE2E(page)).toHaveCount(24);

    await accionConAgenda(page, () =>
      page.getByRole('button', { name: 'Mes', exact: true }).click(),
    );
    await expect(page.getByRole('grid', { name: 'Calendario mensual de citas' })).toBeVisible();
    await expect(diaDelMes(page, datos.simultaneas, 4)).toBeVisible();
    const diaConMuchas = diaDelMes(page, datos.muchas, 20);
    await expect(diaConMuchas).toBeVisible();

    const fechaAntes = await page.locator('input[name="fecha"]').inputValue();
    await accionConAgenda(page, () =>
      page.getByRole('button', { name: 'Periodo siguiente' }).click(),
    );
    await expect(page.locator('input[name="fecha"]')).not.toHaveValue(fechaAntes);
  });

  test('CP4-INT-02 muestra una agenda vacía sin errores', async ({ page }) => {
    await abrirAgenda(page, assertSeed().dates.libre, 'Día');

    await expect(page.locator('.agenda-count')).toContainText('0 citas');
    await expect(page.locator('.agenda-appointment')).toHaveCount(0);
    await expect(page.locator('.agenda-slot-hitarea')).toHaveCount(24);
    await expect(page.locator('.agenda-page .alert.error')).toHaveCount(0);
  });

  test('CP4-INT-07/08/11/12/13 muestra simultáneas en carriles y su detalle', async ({
    page,
  }) => {
    await abrirAgenda(page, assertSeed().dates.simultaneas, 'Día');

    const primera = page.locator('.agenda-appointment').filter({ hasText: 'Paciente E2E 1' });
    const segunda = page.locator('.agenda-appointment').filter({ hasText: 'Paciente E2E 2' });
    await expect(primera).toHaveCount(1);
    await expect(segunda).toHaveCount(1);

    for (const tarjeta of [primera, segunda]) {
      await expect(tarjeta).toHaveAttribute('data-estado', 'pendiente');
      await expect(tarjeta).toHaveAttribute('data-lanes', '2');
      await expect(tarjeta).toContainText('09:00–10:00');
      await expect(tarjeta).toContainText(/E2E-A|E2E-B/);
    }

    const carriles = [
      await primera.getAttribute('data-lane'),
      await segunda.getAttribute('data-lane'),
    ];
    expect(new Set(carriles).size).toBe(2);

    const cajaPrimera = await primera.boundingBox();
    const cajaSegunda = await segunda.boundingBox();
    expect(cajaPrimera).not.toBeNull();
    expect(cajaSegunda).not.toBeNull();
    const [izquierda, derecha] =
      cajaPrimera!.x <= cajaSegunda!.x
        ? [cajaPrimera!, cajaSegunda!]
        : [cajaSegunda!, cajaPrimera!];
    expect(izquierda.x + izquierda.width).toBeLessThanOrEqual(derecha.x + 1);
    expect(Math.abs(izquierda.y - derecha.y)).toBeLessThan(4);

    const extensa = page.locator('.agenda-appointment').filter({ hasText: 'Paciente E2E 4' });
    await expect(extensa).toHaveAttribute('style', /span 4/);
    await expect(extensa).toContainText('11:00–13:00');

    await primera.click();
    const detalle = page.getByRole('dialog', { name: 'Detalle de cita' });
    await expect(detalle).toBeVisible();
    await expect(detalle).toContainText('Paciente E2E 1');
    await expect(detalle).toContainText('Dra. E2E Uno');
    await expect(detalle).toContainText('E2E-A');
    await page.keyboard.press('Escape');
    await expect(detalle).toBeHidden();

    await accionConAgenda(page, () =>
      page.getByRole('button', { name: 'Semana', exact: true }).click(),
    );
    await expect(
      page.locator(
        `.agenda-appointment[aria-label^="Cita ${assertSeed().folios.simultanea[0]},"]`,
      ),
    ).toHaveAttribute('data-lanes', '2');
  });

  test('CP4-INT-14 distingue la cita vencida por color y leyenda', async ({ page }) => {
    const datos = assertSeed().dates;
    await abrirAgenda(page, datos.vencida, 'Día');

    const vencida = page.locator('.agenda-appointment').first();
    await expect(vencida).toHaveAttribute('data-estado', 'vencida');
    await expect(vencida).toHaveClass(/agenda-appointment--vencida/);
    await expect(vencida).not.toContainText(/vencida/i);
    await expect(page.getByRole('list', { name: 'Estados de las citas' })).toContainText(
      'Vencida',
    );
    const estiloVencida = await vencida.evaluate((elemento) => {
      const estilos = getComputedStyle(elemento);
      return { fondo: estilos.backgroundColor, borde: estilos.borderLeftColor };
    });

    await abrirAgenda(page, datos.simultaneas, 'Día');
    const pendiente = page.locator('.agenda-appointment').first();
    await expect(pendiente).toHaveAttribute('data-estado', 'pendiente');
    const estiloPendiente = await pendiente.evaluate((elemento) => {
      const estilos = getComputedStyle(elemento);
      return { fondo: estilos.backgroundColor, borde: estilos.borderLeftColor };
    });

    expect(estiloVencida.fondo).not.toBe(estiloPendiente.fondo);
    expect(estiloVencida.borde).not.toBe(estiloPendiente.borde);
  });

  test('CP4-INT-16 rechaza fechas inválidas sin cambiar la agenda', async ({ page }) => {
    const datos = assertSeed().dates;
    await abrirAgenda(page, datos.simultaneas, 'Día');
    const formulario = page.locator('form.agenda-date-form');
    const antes = await page.locator('.agenda-count').textContent();

    await formulario.getByLabel('Ir a fecha').fill('31/02/2026');
    await formulario.getByRole('button', { name: 'Ir', exact: true }).click();
    await expect(page.locator('.ui-field-error')).toContainText('formato AAAA-MM-DD');
    await expect(page.locator('.agenda-count')).toHaveText(antes!);
    await expect(page.locator('input[name="fecha"]')).toHaveValue(datos.simultaneas);

    await formulario.getByLabel('Ir a fecha').fill('2026-02-31');
    await formulario.getByRole('button', { name: 'Ir', exact: true }).click();
    await expect(page.locator('.ui-field-error')).toContainText('no es una fecha válida');
    await expect(page.locator('.agenda-count')).toHaveText(antes!);

    await accionConAgenda(page, async () => {
      await formulario.getByLabel('Ir a fecha').fill(datos.libre);
      await formulario.getByRole('button', { name: 'Ir', exact: true }).click();
    });
    await expect(page.locator('input[name="fecha"]')).toHaveValue(datos.libre);
    await expect(page.locator('.agenda-count')).toContainText('0 citas');
  });

  test('CP4-INT-17/18/19/20 muestra 24 lapsos, ocupados, libres y la cita de 18:30', async ({
    page,
  }) => {
    const fecha = assertSeed().dates.simultaneas;
    await abrirAgenda(page, fecha, 'Día');

    await expect(page.locator('.agenda-slot-hitarea')).toHaveCount(24);
    await expect(page.locator('.agenda-slot-hitarea.is-occupied')).toHaveCount(7);
    await expect(page.locator('.agenda-slot-hitarea.is-free')).toHaveCount(17);
    await expect(page.locator('.agenda-time-label').first()).toHaveText('07:00');
    await expect(page.locator('.agenda-time-label').last()).toHaveText('18:30');

    await expect(
      page.getByRole('button', { name: `${fecha} 09:00 cita ocupada` }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: `${fecha} 07:00 horario libre` }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: `${fecha} 18:30 cita ocupada` }),
    ).toBeVisible();
    await expect(page.locator('.agenda-appointment').filter({ hasText: '18:30–19:00' })).toHaveCount(
      1,
    );
  });

  test('CP4-INT-06/21 responde y renderiza en los límites acordados', async ({ page }) => {
    const datos = assertSeed().dates;
    await abrirAgenda(page, datos.simultaneas, 'Día');

    const tiempos: number[] = [];
    for (const vista of ['Semana', 'Mes', 'Día'] as const) {
      const inicio = Date.now();
      await accionConAgenda(page, () =>
        page.getByRole('button', { name: vista, exact: true }).click(),
      );
      tiempos.push(Date.now() - inicio);
    }
    expect(Math.max(...tiempos)).toBeLessThan(2000);

    const inicioCarga = Date.now();
    await page.goto('/agenda');
    await expect(page.locator('.agenda-time-label').first()).toBeVisible();
    expect(Date.now() - inicioCarga).toBeLessThan(3000);

    const inicioMuchas = Date.now();
    await abrirAgenda(page, datos.muchas, 'Día');
    await expect(page.locator('.agenda-appointment')).toHaveCount(20);
    expect(Date.now() - inicioMuchas).toBeLessThan(3000);
  });

  test('CP4-INT-09/24 el mes indica el total por día y abre la fecha elegida', async ({ page }) => {
    const datos = assertSeed().dates;
    await abrirAgenda(page, datos.simultaneas, 'Mes');

    await expect(diaDelMes(page, datos.simultaneas, 4)).toBeVisible();
    const diaConMuchas = diaDelMes(page, datos.muchas, 20);
    await expect(diaConMuchas).toBeVisible();

    await accionConAgenda(page, () => diaConMuchas.click());
    await expect(page.getByRole('button', { name: 'Día', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(citasE2E(page)).toHaveCount(20);
    await expect(page.locator('.agenda-count')).toContainText('20 citas');
  });

  test('CP4-INT-32/33 filtra por terapeuta y por sala', async ({ page }) => {
    await abrirAgenda(page, assertSeed().dates.muchas, 'Día');
    await expect(page.locator('.agenda-appointment')).toHaveCount(20);

    await accionConAgenda(page, () =>
      page.getByLabel('Terapeuta').selectOption({ label: 'Dra. E2E Uno' }),
    );
    await expect(page.locator('.agenda-appointment')).toHaveCount(10);
    for (const tarjeta of await page.locator('.agenda-appointment').all()) {
      await expect(tarjeta).toContainText('Dra. E2E Uno');
    }

    await accionConAgenda(page, () => page.getByLabel('Sala').selectOption({ label: 'E2E-A' }));
    await expect(page.locator('.agenda-appointment')).toHaveCount(10);
    for (const tarjeta of await page.locator('.agenda-appointment').all()) {
      await expect(tarjeta).toContainText('E2E-A');
    }

    await accionConAgenda(page, () => page.getByLabel('Sala').selectOption({ label: 'Todas' }));
    await expect(page.locator('.agenda-appointment')).toHaveCount(10);

    await accionConAgenda(page, () =>
      page.getByLabel('Terapeuta').selectOption({ label: 'Todos' }),
    );
    await expect(page.locator('.agenda-appointment')).toHaveCount(20);
  });

  test('CP4-INT-22/25/26/27 imprime el día, protege nombres y genera en menos de 5 s', async ({
    page,
  }) => {
    test.slow();
    const fecha = assertSeed().dates.simultaneas;
    await page.addInitScript(() => {
      (window as Window & { __agendaImpresa?: boolean }).print = () => {
        (window as Window & { __agendaImpresa?: boolean }).__agendaImpresa = true;
      };
    });

    await page.goto(`/agenda/imprimir?vista=dia&fecha=${fecha}`);
    const filas = page.locator('.agenda-print-day tbody tr');
    await expect(filas).toHaveCount(24);
    await expect(page.getByRole('heading', { name: 'Agenda de citas' })).toBeVisible();
    await expect(page.getByText(new RegExp(`Vista diaria.*${fecha}`))).toBeVisible();
    await expect(page.locator('.agenda-print-day tbody tr[data-estado="ocupado"]')).toHaveCount(7);
    await expect(page.locator('.agenda-print-day tbody tr[data-estado="libre"]')).toHaveCount(17);
    await expect(filas.last()).toContainText('18:30–19:00');
    await expect(filas.last()).toContainText('Ocupado');

    await expect(page.getByLabel('Ocultar nombres de pacientes')).toBeChecked();
    await expect(page.getByText(/Paciente E2E \d/)).toHaveCount(0);

    await page.getByRole('button', { name: 'Imprimir agenda' }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () => Boolean((window as Window & { __agendaImpresa?: boolean }).__agendaImpresa),
        ),
      )
      .toBe(true);

    const respuesta = esperarRespuestaDeAgenda(page);
    await page.getByLabel('Ocultar nombres de pacientes').uncheck();
    await respuesta;
    await expect(page.getByText(/Paciente E2E 1/).first()).toBeVisible();

    const inicio = Date.now();
    await page.reload();
    await expect(filas).toHaveCount(24);
    expect(Date.now() - inicio).toBeLessThan(5000);
  });

  test('CP4-INT-23/24 imprime la semana como listado y el mes con conteos', async ({ page }) => {
    const datos = assertSeed().dates;

    await page.goto(`/agenda/imprimir?vista=semana&fecha=${datos.simultaneas}`);
    await expect(page.getByRole('heading', { name: 'Agenda de citas' })).toBeVisible();
    await expect(page.getByText(/Vista semanal/)).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Paciente' })).toHaveCount(0);
    const filasSemana = page.locator('.agenda-print-table tbody tr');
    await expect(filasSemana).toHaveCount(24);
    await expect(filasSemana.first()).toContainText(datos.simultaneas);
    expect(await filasSemana.allTextContents()).toEqual(
      expect.arrayContaining([expect.stringContaining(datos.simultaneas)]),
    );

    await page.goto(`/agenda/imprimir?vista=mes&fecha=${datos.simultaneas}`);
    await expect(page.getByText(/Vista mensual/)).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Citas' })).toBeVisible();
    const filasMes = page.locator('.agenda-print-table tbody tr');
    await expect(filasMes).toHaveCount(diasDelMes(datos.simultaneas));

    const fila = (fecha: string) =>
      page.locator('.agenda-print-table tbody tr').filter({ hasText: fecha });
    await expect(fila(datos.simultaneas)).toContainText('4');
    await expect(fila(datos.muchas)).toContainText('20');
  });

  test('CP4-INT-28 el inicio muestra la agenda del día y sus indicadores', async ({ page }) => {
    await page.goto('/panel');
    await expect(page.getByRole('heading', { name: 'Próximas citas' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ocupación de salas' })).toBeVisible();
    await expect(page.getByText('Citas de hoy')).toBeVisible();
    await expect(page.getByText('Pendientes esta semana')).toBeVisible();
    await expect(page.getByRole('progressbar').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Abrir agenda' })).toHaveAttribute(
      'href',
      '/agenda',
    );
  });

  test('CP4-INT-29/30/35 navegación, sesión y menú móvil', async ({ page }) => {
    await page.goto('/agenda');
    const navegacion = page.getByRole('navigation', { name: 'Navegación principal' });
    await expect(navegacion.getByRole('link', { name: /Agenda/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(navegacion.getByRole('link', { name: /Inicio/ })).toHaveAttribute(
      'href',
      '/panel',
    );
    await expect(page.getByText('Usuario E2E')).toBeVisible();
    await expect(page.getByText('Administrador')).toBeVisible();
    await expect(navegacion.getByRole('link', { name: /Bitácora/ })).toBeVisible();
    await expect(
      navegacion.getByRole('link', { name: /Usuarios y accesos/ }),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    const barra = page.getByLabel('Barra lateral');
    await expect(barra).toHaveClass(/is-open/);
    await page.keyboard.press('Escape');
    await expect(barra).not.toHaveClass(/is-open/);

    await page.getByRole('button', { name: 'Abrir menú' }).click();
    await navegacion.getByRole('link', { name: /Citas/ }).click();
    await expect(page).toHaveURL(/\/citas$/);
    await expect(barra).not.toHaveClass(/is-open/);
  });

  test('CP4-INT-31/34 pide confirmación y cierra la sesión', async ({ page }) => {
    await page.goto('/agenda');
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText('¿Seguro que quieres cerrar la sesión?');
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(page).toHaveURL(/\/agenda$/);

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Cerrar sesión' })
      .click();
    await expect(page).toHaveURL(/\/login$/, { timeout: 20_000 });

    await page.goto('/agenda');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('refresca la agenda al cancelar una cita en otra pestaña', async ({ page, context }) => {
    const datos = assertSeed().dates;
    const folio = assertSeed().folios.muchas[0];
    await abrirAgenda(page, datos.muchas, 'Día');
    await expect(page.locator('.agenda-count')).toContainText('20 citas');

    const otra = await context.newPage();
    await otra.goto('/citas');
    await expect(otra.getByRole('heading', { name: 'Citas' })).toBeVisible();
    await otra.getByLabel('Desde').fill(datos.muchas);
    await otra.getByLabel('Hasta').fill(datos.muchas);

    const fila = otra.getByRole('row').filter({ hasText: folio });
    await expect(fila).toBeVisible({ timeout: 15_000 });
    await fila.getByRole('button', { name: `Acciones para ${folio}` }).click();
    await otra.getByRole('menuitem', { name: 'Cancelar' }).click();
    const confirmacion = otra.getByRole('dialog', { name: 'Confirmar cancelación' });
    await expect(confirmacion).toBeVisible();
    await confirmacion.getByRole('button', { name: 'Cancelar cita' }).click();

    await expect(page.locator('.agenda-count')).toContainText('19 citas', { timeout: 15_000 });
    await expect(
      page.locator('.agenda-appointment').filter({ hasText: '07:00–07:30' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: `${datos.muchas} 07:00 horario libre` }),
    ).toBeVisible();

    await otra.close();
  });
});
