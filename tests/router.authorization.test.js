const request = require('supertest');
const app = require('../src/app');
const { bearer, loginAs, useTestDatabase } = require('./helpers');

const mountedRouters = [
  ['/api/pacientes', require('../src/modules/pacientes/pacientes.routes')],
  ['/api/terapeutas', require('../src/modules/terapeutas/terapeutas.routes')],
  ['/api/salas', require('../src/modules/salas/salas.routes')],
  ['/api/citas', require('../src/modules/citas/citas.routes')],
  ['/api/agenda', require('../src/modules/agenda/agenda.routes')],
  ['/api/dashboard', require('../src/modules/dashboard/dashboard.routes')],
  ['/api/auditoria', require('../src/modules/auditoria/auditoria.routes')],
  ['/api/admin', require('../src/modules/admin/admin.routes')],
];

function allProtectedEndpoints() {
  return mountedRouters.flatMap(([prefix, router]) =>
    router.stack
      .filter((layer) => layer.route)
      .flatMap((layer) => {
        const routePath = layer.route.path.replace(/:id/g, '1').replace(/:folio/g, 'CIT-2026-000001');
        return Object.keys(layer.route.methods)
          .filter((method) => layer.route.methods[method])
          .map((method) => ({ method, url: `${prefix}${routePath === '/' ? '' : routePath}` }));
      }),
  );
}

describe('Protección automática del router API', () => {
  useTestDatabase();

  test('todas las rutas de módulos requieren una sesión válida antes de validar o ejecutar handlers', async () => {
    const endpoints = allProtectedEndpoints();
    expect(endpoints.length).toBeGreaterThan(40);

    for (const { method, url } of endpoints) {
      const response = await request(app)[method](url);
      expect({ method, url, status: response.status }).toMatchObject({ status: 401 });
    }

    const invalidToken = await request(app)
      .get('/api/pacientes')
      .set('Authorization', 'Bearer invalid-token');
    expect(invalidToken.status).toBe(401);
  });

  test('todas las rutas de administración rechazan a secretaria con 403', async () => {
    const token = await loginAs(app);
    const endpoints = [
      ['get', '/api/auditoria'],
      ['get', '/api/admin/correos-autorizados'],
      ['post', '/api/admin/correos-autorizados'],
      ['delete', '/api/admin/correos-autorizados/1'],
      ['get', '/api/admin/usuarios'],
      ['put', '/api/admin/usuarios/1/rol'],
      ['post', '/api/pacientes/1/anonimizar'],
      ['post', '/api/pacientes/1/reactivar'],
    ];

    for (const [method, url] of endpoints) {
      const response = await request(app)[method](url).set(bearer(token));
      expect({ method, url, status: response.status }).toMatchObject({ status: 403 });
    }
  });
});
