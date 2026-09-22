const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/errors');

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return next(new AppError('Token de autenticación requerido.', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.user = decoded;
    return next();
  } catch (error) {
    return next(new AppError('Token inválido o expirado.', 401));
  }
}

module.exports = {
  authenticateToken,
};
