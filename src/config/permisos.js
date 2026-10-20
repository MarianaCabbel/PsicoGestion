/**
 * Matriz de permisos por acción. Cambiar quién puede hacer qué es editar una
 * línea de este archivo. El rol vive en usuarios_administrativos.rol.
 */
const ROLES = Object.freeze({
  SECRETARIA: 'secretaria',
  ADMINISTRADOR: 'administrador',
});

const TODOS = [ROLES.SECRETARIA, ROLES.ADMINISTRADOR];

const PERMISOS = Object.freeze({
  'pacientes:leer': TODOS,
  'pacientes:crear': TODOS,
  'pacientes:editar': TODOS,
  'pacientes:baja': TODOS,
  'pacientes:reactivar': [ROLES.ADMINISTRADOR],
  'pacientes:consentimiento': TODOS,
  'terapeutas:leer': TODOS,
  'terapeutas:crear': TODOS,
  'terapeutas:editar': TODOS,
  'terapeutas:baja': TODOS,
  'terapeutas:reactivar': [ROLES.ADMINISTRADOR],
  'salas:leer': TODOS,
  'salas:crear': TODOS,
  'salas:baja': TODOS,
  'salas:reactivar': [ROLES.ADMINISTRADOR],
  'citas:leer': TODOS,
  'citas:crear': TODOS,
  'citas:editar': TODOS,
  'citas:cancelar': TODOS,
});

module.exports = { ROLES, PERMISOS };
