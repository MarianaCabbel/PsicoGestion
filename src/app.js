const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');
const pacientesRoutes = require('./modules/pacientes/pacientes.routes');
const terapeutasRoutes = require('./modules/terapeutas/terapeutas.routes');
const salasRoutes = require('./modules/salas/salas.routes');
const citasRoutes = require('./modules/citas/citas.routes');
const { registrarGuardsDeCitas } = require('./modules/citas/citas.guards');
const { errorHandler, AppError } = require('./utils/errors');
const { sequelize } = require('./config/database');
const { getAllowedOrigins, getTrustProxy } = require('./config/env');
const { limitadores } = require('./middleware/rateLimiters');
const { originGuard } = require('./middleware/originGuard');

registrarGuardsDeCitas();

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', getTrustProxy());

app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));

app.use(
  cors({
    origin: (origin, callback) => {
      // Sin cabecera Origin (curl, mismo origen, pruebas) no hay CORS que aplicar.
      if (!origin || getAllowedOrigins().includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '100kb' }));

app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Servicio activo' });
});

app.get('/health/ready', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ success: true, message: 'Servicio listo' });
  } catch (error) {
    res.status(503).json({ success: false, message: 'Base de datos no disponible' });
  }
});

app.use('/api', limitadores.api, originGuard);

app.use('/api/auth', authRoutes);
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/terapeutas', terapeutasRoutes);
app.use('/api/salas', salasRoutes);
app.use('/api/citas', citasRoutes);

app.use('/api', (req, res, next) => next(new AppError('Recurso no encontrado.', 404)));

app.use(errorHandler);

module.exports = app;
