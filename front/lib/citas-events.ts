/**
 * Canal entre pestañas para que la agenda y el listado de citas no muestren
 * información desactualizada después de crear, modificar o cancelar una cita.
 */
export const CITAS_CHANNEL = 'psicogestion:citas';

const disponible = () =>
  typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined';

/** Avisa a las demás vistas abiertas de que las citas cambiaron. */
export function anunciarCambioDeCitas(): void {
  if (!disponible()) return;
  const channel = new BroadcastChannel(CITAS_CHANNEL);
  channel.postMessage({ tipo: 'citas-actualizadas', at: Date.now() });
  channel.close();
}

/** Escucha cambios de citas hechos en otra pestaña o vista. */
export function escucharCambiosDeCitas(onChange: () => void): () => void {
  if (!disponible()) return () => {};
  const channel = new BroadcastChannel(CITAS_CHANNEL);
  channel.onmessage = () => onChange();
  return () => channel.close();
}
