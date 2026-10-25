'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AppFrame } from '@/components/app/app-frame';
import { useSession } from '@/components/providers/session-provider';
import { Button } from '@/components/ui/button';
import { DataTable, type DataColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

type AuditEntry = {
  id: number;
  usuario_id: number | null;
  accion: string;
  entidad: string;
  entidad_id: number | null;
  detalle: { campos?: string[]; aviso_version?: string } | null;
  created_at: string;
};
type PageResult<T> = {
  items: T[];
  page: number;
  total: number;
  total_paginas: number;
};
type AuditFilters = { accion: string; entidad: string; desde: string; hasta: string };
const emptyFilters: AuditFilters = { accion: '', entidad: '', desde: '', hasta: '' };
const PAGE_SIZE = 20;

export default function AuditoriaPage() {
  const { user } = useSession();
  const router = useRouter();
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PageResult<AuditEntry>>({
    items: [],
    page: 1,
    total: 0,
    total_paginas: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && user.rol !== 'administrador') router.replace('/panel');
  }, [router, user]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      try {
        const response = await api<PageResult<AuditEntry>>(`/api/auditoria?${params}`, { signal });
        setResult(response.data);
      } catch (cause) {
        if (!(cause instanceof Error && cause.name === 'AbortError')) {
          setError(cause instanceof Error ? cause.message : 'No se pudo cargar la bitácora.');
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [appliedFilters, page],
  );

  useEffect(() => {
    if (user?.rol !== 'administrador') return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, user]);

  const columns: DataColumn<AuditEntry>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      render: (entry) => new Date(entry.created_at).toLocaleString('es-MX'),
    },
    { key: 'usuario', header: 'Usuario ID', render: (entry) => entry.usuario_id ?? 'Sistema' },
    { key: 'accion', header: 'Acción', render: (entry) => entry.accion },
    { key: 'entidad', header: 'Entidad', render: (entry) => entry.entidad },
    { key: 'registro', header: 'Registro ID', render: (entry) => entry.entidad_id ?? '—' },
    {
      key: 'detalle',
      header: 'Detalle no identificable',
      render: (entry) =>
        entry.detalle
          ? [
              entry.detalle.campos?.length ? `Campos: ${entry.detalle.campos.join(', ')}` : '',
              entry.detalle.aviso_version ? `Aviso ${entry.detalle.aviso_version}` : '',
            ]
              .filter(Boolean)
              .join(' · ') || '—'
          : '—',
    },
  ];

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  }

  if (user?.rol !== 'administrador') {
    return <p role="status">Esta sección está disponible únicamente para administración.</p>;
  }

  return (
    <AppFrame>
      <div className="clinical-page">
        <header className="clinical-heading">
          <div>
            <p className="eyebrow">Control y cumplimiento</p>
            <h2>Bitácora de auditoría</h2>
            <p className="clinical-subtitle">
              Historial de accesos y operaciones, sin valores de datos personales en el detalle.
            </p>
          </div>
        </header>
        <form
          aria-label="Filtros de bitácora"
          className="clinical-filters"
          onSubmit={submitFilters}
        >
          <Input
            label="Acción"
            onChange={(event) =>
              setFilters((current) => ({ ...current, accion: event.target.value }))
            }
            value={filters.accion}
          />
          <Input
            label="Entidad"
            onChange={(event) =>
              setFilters((current) => ({ ...current, entidad: event.target.value }))
            }
            value={filters.entidad}
          />
          <Input
            label="Desde"
            onChange={(event) =>
              setFilters((current) => ({ ...current, desde: event.target.value }))
            }
            type="date"
            value={filters.desde}
          />
          <Input
            label="Hasta"
            onChange={(event) =>
              setFilters((current) => ({ ...current, hasta: event.target.value }))
            }
            type="date"
            value={filters.hasta}
          />
          <Button type="submit">Aplicar filtros</Button>
        </form>
        {error && (
          <p className="clinical-error" role="alert">
            {error}
          </p>
        )}
        <p aria-live="polite" className="clinical-result-count">
          {result.total} registros
        </p>
        <DataTable
          columns={columns}
          emptyDescription="Prueba con otros filtros."
          emptyTitle="No hay registros de auditoría"
          getRowId={(entry) => entry.id}
          loading={loading}
          rows={result.items}
        />
        <nav aria-label="Paginación de bitácora" className="clinical-pagination">
          <Button
            disabled={loading || page <= 1}
            onClick={() => setPage((value) => value - 1)}
            variant="secondary"
          >
            Anterior
          </Button>
          <span aria-live="polite">
            Página {page} de {result.total_paginas}
          </span>
          <Button
            disabled={loading || page >= result.total_paginas}
            onClick={() => setPage((value) => value + 1)}
            variant="secondary"
          >
            Siguiente
          </Button>
        </nav>
      </div>
    </AppFrame>
  );
}
