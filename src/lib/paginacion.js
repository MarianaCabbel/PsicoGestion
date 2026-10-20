const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { PAGINA_LIMITE_MAXIMO, PAGINA_LIMITE_DEFECTO } = require('../config/clinica');

function calcularPaginacion({ page = 1, limit = PAGINA_LIMITE_DEFECTO } = {}) {
  const pagina = Math.max(1, Number(page) || 1);
  const limite = Math.min(PAGINA_LIMITE_MAXIMO, Math.max(1, Number(limit) || PAGINA_LIMITE_DEFECTO));

  return { page: pagina, limit: limite, offset: (pagina - 1) * limite };
}

function respuestaPaginada(items, total, { page, limit }) {
  return { items, page, limit, total, total_paginas: Math.max(1, Math.ceil(total / limit)) };
}

/** Operador LIKE insensible a mayúsculas según el dialecto activo. */
function operadorLike() {
  return sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;
}

/** Elimina comodines para que el texto del usuario no altere el patrón LIKE. */
function patronContiene(texto) {
  const limpio = String(texto || '').replace(/[%_\\]/g, '').trim();
  return `%${limpio}%`;
}

module.exports = { calcularPaginacion, respuestaPaginada, operadorLike, patronContiene };
