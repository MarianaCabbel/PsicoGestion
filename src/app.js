const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const { errorHandler } = require('./utils/errors');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Servicio activo' });
});

app.use('/api/auth', authRoutes);

app.use(errorHandler);

module.exports = app;
