'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type ApiRecord = Record<string, unknown>;
type Column = { key: string; label: string };

export type FormField = {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'date' | 'time' | 'number' | 'select';
  required?: boolean;
  nullable?: boolean;
  valueKey?: string;
  options?: { value: string; label: string }[];
  help?: string;
};

type ModuleListProps = {
  endpoint: string;
  title: string;
  description: string;
  columns: Column[];
  fields: FormField[];
  deleteMethod?: 'DELETE' | 'POST';
  deletePath?: string;
  deleteBody?: Record<string, unknown>;
  deleteLabel?: string;
  deleteRequiresStatus?: string;
};

function valueAtPath(record: ApiRecord, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value && typeof value === 'object' && key in value) {
      return (value as ApiRecord)[key];
    }
    return undefined;
  }, record);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function ModuleList({
  endpoint,
  title,
  description,
  columns,
  fields,
  deleteMethod,
  deletePath,
  deleteBody,
  deleteLabel,
  deleteRequiresStatus,
}: ModuleListProps) {
  const recordName = title.replace(/s$/, '');
  const createLabel = recordName === 'Cita' ? 'Nueva Cita' : `Nuevo ${recordName}`;
  const [records, setRecords] = useState<ApiRecord[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ApiRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const loadRecords = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');

      try {
        const result = await api<unknown>(`/api/${endpoint}?page=1&limit=20`, { signal });
        const data = result.data;
        const rows = Array.isArray(data)
          ? data
          : data && typeof data === 'object' && 'items' in data && Array.isArray(data.items)
            ? data.items
            : null;

        if (!rows || rows.some((row) => !row || typeof row !== 'object')) {
          throw new Error('La API devolvió una lista con un formato inesperado.');
        }

        setRecords(rows as ApiRecord[]);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name !== 'AbortError') {
          setError(loadError.message);
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [endpoint],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadRecords(controller.signal);
    return () => controller.abort();
  }, [loadRecords]);

  function openCreateForm() {
    setEditing(null);
    setFormValues({});
    setError('');
    setNotice('');
    setFormOpen(true);
  }

  function openEditForm(record: ApiRecord) {
    setEditing(record);
    setFormValues(
      Object.fromEntries(
        fields.map((field) => {
          const value = valueAtPath(record, field.valueKey || field.name);
          const text = value === null || value === undefined ? '' : String(value);
          return [field.name, field.type === 'date' ? text.slice(0, 10) : text];
        }),
      ),
    );
    setError('');
    setNotice('');
    setFormOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    const payload: Record<string, unknown> = {};
    fields.forEach((field) => {
      const value = formValues[field.name]?.trim() ?? '';
      if (!value) {
        if (field.nullable) payload[field.name] = null;
        return;
      }
      payload[field.name] = field.type === 'number' ? Number(value) : value;
    });

    try {
      await api<unknown>(
        editing ? `/api/${endpoint}/${encodeURIComponent(String(editing.id))}` : `/api/${endpoint}`,
        { method: editing ? 'PUT' : 'POST', body: payload },
      );

      setFormOpen(false);
      setNotice(editing ? 'Registro actualizado correctamente.' : 'Registro creado correctamente.');
      await loadRecords();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el registro.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(record: ApiRecord) {
    const identifier = String(record.id ?? '');
    const actionLabel = deleteLabel || 'eliminar';
    if (
      !window.confirm(
        `¿Confirmas ${actionLabel} este registro${identifier ? ` (#${identifier})` : ''}?`,
      )
    )
      return;

    setError('');
    setNotice('');
    setSaving(true);

    try {
      await api<unknown>(
        `/api/${endpoint}/${encodeURIComponent(identifier)}${deletePath ? `/${deletePath}` : ''}`,
        { method: deleteMethod || 'DELETE', body: deleteBody },
      );

      setNotice(
        deleteLabel === 'cancelar'
          ? 'Cita cancelada correctamente.'
          : 'Registro eliminado correctamente.',
      );
      await loadRecords();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'No se pudo completar la acción.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="module-page">
      <div className="module-heading">
        <div>
          <p className="eyebrow">PsicoGestión · Administración</p>
          <h1>{title}</h1>
          <p className="module-description">{description}</p>
        </div>
        <div className="module-actions">
          <button
            type="button"
            className="primary-action"
            onClick={openCreateForm}
            disabled={saving}
          >
            {createLabel}
          </button>
          <Link className="module-refresh" href="/panel">
            Ir al panel
          </Link>
        </div>
      </div>

      {notice && (
        <p className="alert success" role="status">
          {notice}
        </p>
      )}
      {loading && (
        <p className="module-message" role="status">
          Cargando información…
        </p>
      )}
      {!loading && error && !formOpen && (
        <div className="alert error module-message" role="alert">
          <p>{error}</p>
          {(error.includes('Token') || error.includes('sesión')) && (
            <Link href="/login">Volver a iniciar sesión</Link>
          )}
        </div>
      )}
      {!loading && !error && records.length === 0 && (
        <p className="module-message">No hay registros disponibles.</p>
      )}
      {!loading && !error && records.length > 0 && (
        <div className="table-scroll">
          <table className="module-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => (
                <tr key={String(record.id ?? record.folio ?? index)}>
                  {columns.map((column) => (
                    <td key={column.key}>{formatValue(valueAtPath(record, column.key))}</td>
                  ))}
                  <td>
                    <div className="row-actions">
                      <button type="button" onClick={() => openEditForm(record)} disabled={saving}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="danger-action"
                        onClick={() => void deleteRecord(record)}
                        disabled={
                          saving ||
                          (deleteRequiresStatus !== undefined &&
                            record.estado !== deleteRequiresStatus)
                        }
                        title={
                          deleteRequiresStatus !== undefined &&
                          record.estado !== deleteRequiresStatus
                            ? `Solo se puede ${deleteLabel} un registro con estado ${deleteRequiresStatus}.`
                            : undefined
                        }
                      >
                        {deleteLabel === 'cancelar' ? 'Cancelar cita' : 'Eliminar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !error && records.length > 0 && (
        <p className="module-count">Mostrando {records.length} registros (máximo 20).</p>
      )}

      {formOpen && (
        <div className="modal-backdrop">
          <section
            className="record-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-form-title"
          >
            <div className="modal-heading">
              <h2 id="record-form-title">{editing ? `Editar ${recordName}` : createLabel}</h2>
              <button
                type="button"
                className="modal-close"
                aria-label="Cerrar formulario"
                onClick={() => setFormOpen(false)}
                disabled={saving}
              >
                ×
              </button>
            </div>
            {error && (
              <p className="alert error" role="alert">
                {error}
              </p>
            )}
            <form className="record-form" onSubmit={submitForm}>
              {fields.map((field) => (
                <label key={field.name}>
                  {field.label}
                  {field.type === 'select' ? (
                    <select
                      required={field.required}
                      value={formValues[field.name] ?? ''}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          [field.name]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Selecciona una opción</option>
                      {field.options?.map((option) => (
                        <option value={option.value} key={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      min={field.type === 'number' ? 1 : undefined}
                      step={field.type === 'number' ? 1 : undefined}
                      required={field.required}
                      value={formValues[field.name] ?? ''}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          [field.name]: event.target.value,
                        }))
                      }
                    />
                  )}
                  {field.help && <small>{field.help}</small>}
                </label>
              ))}
              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="primary-action" disabled={saving}>
                  {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear registro'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
