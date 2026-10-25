'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { AgendaView } from '@/components/agenda/agenda-toolbar';
import { Button } from '@/components/ui/button';

type PrintAppointment = {
  folio: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  paciente: { nombre_completo: string };
  terapeuta: { nombre_completo: string };
  sala: { nombre: string };
};
type PrintDay = { fecha: string; total: number; dia_atencion: boolean };
type PrintAgenda = {
  vista: AgendaView;
  fecha: string;
  desde: string;
  hasta: string;
  citas?: PrintAppointment[];
  dias?: PrintDay[];
};

function AgendaPrintContent() {
  const params = useSearchParams();
  const view = (params.get('vista') ?? 'dia') as AgendaView;
  const date = params.get('fecha') ?? new Date().toISOString().slice(0, 10);
  const [hideNames, setHideNames] = useState(true);
  const [agenda, setAgenda] = useState<PrintAgenda | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ vista: view, fecha: date, privado: hideNames ? '1' : '0' });
    const therapistId = params.get('terapeuta_id');
    const roomId = params.get('sala_id');
    if (therapistId) query.set('terapeuta_id', therapistId);
    if (roomId) query.set('sala_id', roomId);
    void api<PrintAgenda>(`/api/agenda?${query}`, { signal: controller.signal })
      .then((response) => setAgenda(response.data))
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name !== 'AbortError') setError(cause.message);
      });
    return () => controller.abort();
  }, [date, hideNames, params, view]);

  const period = agenda
    ? agenda.desde === agenda.hasta
      ? agenda.desde
      : `${agenda.desde} — ${agenda.hasta}`
    : date;

  return (
    <main className="agenda-print-page">
      <div className="agenda-print-controls no-print">
        <label className="agenda-privacy-toggle">
          <input
            checked={hideNames}
            onChange={(event) => setHideNames(event.target.checked)}
            type="checkbox"
          />
          Ocultar nombres de pacientes
        </label>
        <Button disabled={!agenda} onClick={() => window.print()}>
          Imprimir agenda
        </Button>
      </div>
      {error && (
        <p className="alert error no-print" role="alert">
          {error}
        </p>
      )}
      <article className="agenda-print-sheet">
        <header className="agenda-print-header">
          <div className="agenda-print-logo" aria-hidden="true">
            PG
          </div>
          <div>
            <p className="eyebrow">PsicoGestión · Atención clínica</p>
            <h1>Agenda de citas</h1>
            <p>
              {view === 'dia'
                ? 'Vista diaria'
                : view === 'semana'
                  ? 'Vista semanal'
                  : 'Vista mensual'}{' '}
              · {period}
            </p>
          </div>
          <p className="agenda-print-generated">Generada {new Date().toLocaleString('es-MX')}</p>
        </header>
        {!agenda ? (
          <p className="no-print">Cargando agenda…</p>
        ) : view === 'mes' ? (
          <table className="agenda-print-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Atención</th>
                <th>Citas</th>
              </tr>
            </thead>
            <tbody>
              {agenda.dias?.map((day) => (
                <tr key={day.fecha}>
                  <td>{day.fecha}</td>
                  <td>{day.dia_atencion ? 'Sí' : 'No'}</td>
                  <td>{day.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="agenda-print-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Horario</th>
                <th>Paciente</th>
                <th>Terapeuta</th>
                <th>Sala</th>
                <th>Folio</th>
              </tr>
            </thead>
            <tbody>
              {agenda.citas?.map((appointment) => (
                <tr key={appointment.folio}>
                  <td>{appointment.fecha}</td>
                  <td>
                    {appointment.hora_inicio}–{appointment.hora_fin}
                  </td>
                  <td>{hideNames ? 'Paciente reservado' : appointment.paciente.nombre_completo}</td>
                  <td>{appointment.terapeuta.nombre_completo}</td>
                  <td>{appointment.sala.nombre}</td>
                  <td>{appointment.folio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <footer className="agenda-print-footer">
          Documento de uso clínico interno · Manejar conforme al aviso de privacidad.
        </footer>
      </article>
    </main>
  );
}

export default function AgendaPrintPage() {
  return (
    <Suspense fallback={<main className="agenda-print-page">Cargando vista imprimible…</main>}>
      <AgendaPrintContent />
    </Suspense>
  );
}
