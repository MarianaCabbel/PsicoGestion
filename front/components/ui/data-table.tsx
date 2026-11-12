import type { ReactNode } from 'react';
import { EmptyState } from './empty-state';
import { Skeleton } from './skeleton';

export type DataColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
};

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  loading = false,
  emptyTitle = 'Sin resultados',
  emptyDescription = 'No hay datos para mostrar.',
}: {
  rows: T[];
  columns: DataColumn<T>[];
  getRowId: (row: T) => string | number;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (loading) {
    return (
      <div aria-label="Cargando datos" className="ui-table-loading" role="status">
        {columns.map((column) => (
          <Skeleton className="ui-table-skeleton" key={column.key} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowId(row)}>
              {columns.map((column) => (
                <td data-label={column.header} key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
