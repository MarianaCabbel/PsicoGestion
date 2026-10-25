'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppFrame } from '@/components/app/app-frame';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

type DashboardSummary = {
  fecha: string;
  citas_hoy: number;
  pendientes_semana: number;
  pacientes_activos: number;
  terapeutas_activos: number;
  ocupacion_salas: {
    id: number;
    nombre: string;
    bloques_ocupados: number;
    bloques_totales: number;
    porcentaje: number;
  }[];
  proximas_citas: {
    id: number;
    folio: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    paciente: string;
    terapeuta: string;
    sala: string;
  }[];
};

const kpis = (summary: DashboardSummary) => [
  { label: 'Citas de hoy', value: summary.citas_hoy, href: '/citas' },
  { label: 'Pendientes esta semana', value: summary.pendientes_semana, href: '/agenda' },
  { label: 'Pacientes activos', value: summary.pacientes_activos, href: '/pacientes' },
  { label: 'Terapeutas activos', value: summary.terapeutas_activos, href: '/terapeutas' },
];

export default function PanelPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void api<DashboardSummary>('/api/dashboard/resumen', { signal: controller.signal })
      .then((response) => setSummary(response.data))
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name !== 'AbortError') setError(cause.message);
      });
    return () => controller.abort();
  }, []);

  return (
    <AppFrame>
      <main className="clinical-page dashboard-page">
        <header className="clinical-heading">
          <div>
            <p className="eyebrow">PsicoGestión · Panel de control</p>
            <h1>Bienvenida/o</h1>
            <p className="module-description">
              Resumen operativo de la clínica · {summary?.fecha ?? 'Actualizando…'}
            </p>
          </div>
          <Link className="ui-button ui-button--primary" href="/agenda">
            Abrir agenda
          </Link>
        </header>
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        <section className="dashboard-kpis" aria-label="Indicadores principales">
          {summary
            ? kpis(summary).map((item) => (
                <Link className="dashboard-kpi-link" href={item.href} key={item.label}>
                  <Card className="dashboard-kpi">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </Card>
                </Link>
              ))
            : [1, 2, 3, 4].map((item) => (
                <Skeleton className="dashboard-kpi-skeleton" key={item} />
              ))}
        </section>
        <section className="dashboard-columns">
          <Card className="dashboard-section">
            <div className="room-section-heading">
              <div>
                <p className="eyebrow">Agenda</p>
                <h2>Próximas citas</h2>
              </div>
              <Link href="/citas">Ver todas</Link>
            </div>
            {!summary ? (
              <Skeleton className="dashboard-list-skeleton" />
            ) : summary.proximas_citas.length === 0 ? (
              <EmptyState
                title="Sin próximas citas"
                description="Las citas programadas aparecerán aquí."
              />
            ) : (
              <div className="dashboard-appointment-list">
                {summary.proximas_citas.map((appointment) => (
                  <article className="dashboard-appointment" key={appointment.id}>
                    <div>
                      <strong>
                        {appointment.fecha} · {appointment.hora_inicio}
                      </strong>
                      <p>{appointment.paciente}</p>
                      <small>
                        {appointment.terapeuta} · {appointment.sala}
                      </small>
                    </div>
                    <Badge variant="success">{appointment.folio}</Badge>
                  </article>
                ))}
              </div>
            )}
          </Card>
          <Card className="dashboard-section">
            <div className="room-section-heading">
              <div>
                <p className="eyebrow">Hoy</p>
                <h2>Ocupación de salas</h2>
              </div>
              <Link href="/salas">Ver salas</Link>
            </div>
            {!summary ? (
              <Skeleton className="dashboard-list-skeleton" />
            ) : summary.ocupacion_salas.length === 0 ? (
              <EmptyState
                title="Sin salas activas"
                description="Registra salas para consultar su ocupación."
              />
            ) : (
              <div className="dashboard-room-list">
                {summary.ocupacion_salas.map((room) => (
                  <div className="dashboard-room" key={room.id}>
                    <div className="dashboard-room-label">
                      <strong>{room.nombre}</strong>
                      <span>
                        {room.porcentaje}% · {room.bloques_ocupados}/{room.bloques_totales} bloques
                      </span>
                    </div>
                    <div
                      aria-label={`${room.nombre}: ${room.porcentaje}% de ocupación`}
                      className="dashboard-progress"
                      role="progressbar"
                      aria-valuenow={room.porcentaje}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span style={{ width: `${room.porcentaje}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      </main>
    </AppFrame>
  );
}
