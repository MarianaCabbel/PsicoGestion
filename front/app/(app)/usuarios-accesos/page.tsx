'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AppFrame } from '@/components/app/app-frame';
import { useSession } from '@/components/providers/session-provider';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type AuthorizedEmail = { id: number; correo: string; activo: boolean; created_at: string };
type UserRecord = {
  id: number;
  nombre_completo: string;
  correo_institucional: string;
  telefono: string;
  rol: 'secretaria' | 'administrador';
  verificado: boolean;
  fecha_creacion: string;
};
type PageResult<T> = { items: T[]; total: number };
type PendingEmail = Pick<AuthorizedEmail, 'id' | 'correo'>;

export default function UsersAndAccessPage() {
  const { user } = useSession();
  const router = useRouter();
  const [emails, setEmails] = useState<AuthorizedEmail[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roleDrafts, setRoleDrafts] = useState<Record<number, UserRecord['rol']>>({});
  const [email, setEmail] = useState('');
  const [pendingEmail, setPendingEmail] = useState<PendingEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && user.rol !== 'administrador') router.replace('/panel');
  }, [router, user]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const [emailResponse, userResponse] = await Promise.all([
        api<PageResult<AuthorizedEmail>>('/api/admin/correos-autorizados?page=1&limit=100', {
          signal,
        }),
        api<PageResult<UserRecord>>('/api/admin/usuarios?page=1&limit=100', { signal }),
      ]);
      setEmails(emailResponse.data.items);
      setUsers(userResponse.data.items);
      setRoleDrafts(
        Object.fromEntries(userResponse.data.items.map((record) => [record.id, record.rol])),
      );
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === 'AbortError')) {
        setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los accesos.');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.rol !== 'administrador') return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, user]);

  async function addEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await api('/api/admin/correos-autorizados', { method: 'POST', body: { correo: email } });
      setEmail('');
      toast.success('Correo agregado a la lista de acceso.');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo autorizar el correo.');
    } finally {
      setSaving(false);
    }
  }

  async function revokeEmail() {
    if (!pendingEmail) return;
    setSaving(true);
    try {
      await api(`/api/admin/correos-autorizados/${pendingEmail.id}`, { method: 'DELETE' });
      toast.success('Acceso revocado.');
      setPendingEmail(null);
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo revocar el acceso.');
    } finally {
      setSaving(false);
    }
  }

  async function saveRole(record: UserRecord) {
    const rol = roleDrafts[record.id];
    if (!rol || rol === record.rol) return;
    setSaving(true);
    try {
      await api(`/api/admin/usuarios/${record.id}/rol`, { method: 'PUT', body: { rol } });
      toast.success('Rol actualizado; las sesiones previas del usuario quedaron invalidadas.');
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo actualizar el rol.');
    } finally {
      setSaving(false);
    }
  }

  const emailColumns: DataColumn<AuthorizedEmail>[] = [
    { key: 'correo', header: 'Correo autorizado', render: (record) => record.correo },
    {
      key: 'estado',
      header: 'Estado',
      render: (record) => (record.activo ? 'Activo' : 'Inactivo'),
    },
    {
      key: 'accion',
      header: 'Acción',
      render: (record) => (
        <Button
          disabled={saving || !record.activo}
          onClick={() => setPendingEmail(record)}
          size="sm"
          variant="danger"
        >
          Revocar
        </Button>
      ),
    },
  ];

  const userColumns: DataColumn<UserRecord>[] = [
    { key: 'nombre', header: 'Usuario', render: (record) => record.nombre_completo },
    {
      key: 'correo',
      header: 'Correo institucional',
      render: (record) => record.correo_institucional,
    },
    {
      key: 'verificado',
      header: 'Verificación',
      render: (record) => (record.verificado ? 'Verificado' : 'Pendiente'),
    },
    {
      key: 'rol',
      header: 'Rol',
      render: (record) => (
        <div className="clinical-row-actions">
          <Select
            aria-label={`Rol de ${record.nombre_completo}`}
            disabled={saving || record.id === user?.id}
            label={`Rol de ${record.nombre_completo}`}
            onChange={(event) =>
              setRoleDrafts((current) => ({
                ...current,
                [record.id]: event.target.value as UserRecord['rol'],
              }))
            }
            value={roleDrafts[record.id] ?? record.rol}
          >
            <option value="secretaria">Secretaria</option>
            <option value="administrador">Administradora</option>
          </Select>
          <Button
            disabled={saving || record.id === user?.id || roleDrafts[record.id] === record.rol}
            onClick={() => void saveRole(record)}
            size="sm"
            variant="secondary"
          >
            Guardar rol
          </Button>
        </div>
      ),
    },
  ];

  if (user?.rol !== 'administrador') {
    return <p role="status">Esta sección está disponible únicamente para administración.</p>;
  }

  return (
    <AppFrame>
      <div className="clinical-page">
        <header className="clinical-heading">
          <div>
            <p className="eyebrow">Control de acceso</p>
            <h2>Usuarios y accesos</h2>
            <p className="clinical-subtitle">
              Administra la lista de correos y los roles del personal verificado.
            </p>
          </div>
        </header>
        {error && (
          <p className="clinical-error" role="alert">
            {error}
          </p>
        )}
        <section aria-labelledby="authorized-emails-title" className="admin-access-section">
          <h3 id="authorized-emails-title">Correos autorizados</h3>
          <form
            aria-label="Autorizar correo"
            className="clinical-filters"
            onSubmit={(event) => void addEmail(event)}
          >
            <Input
              autoComplete="email"
              label="Correo institucional"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
            <Button disabled={saving} type="submit">
              {saving ? 'Guardando…' : 'Autorizar correo'}
            </Button>
          </form>
          <DataTable
            columns={emailColumns}
            emptyDescription="Agrega un correo institucional para conceder acceso de registro."
            emptyTitle="No hay correos autorizados"
            getRowId={(record) => record.id}
            loading={loading}
            rows={emails}
          />
        </section>
        <section aria-labelledby="users-list-title" className="admin-access-section">
          <h3 id="users-list-title">Cuentas de usuario</h3>
          <DataTable
            columns={userColumns}
            emptyDescription="Las cuentas creadas aparecerán aquí."
            emptyTitle="No hay usuarios"
            getRowId={(record) => record.id}
            loading={loading}
            rows={users}
          />
        </section>
        <ConfirmDialog
          busy={saving}
          confirmLabel="Revocar acceso"
          description={
            pendingEmail
              ? `El correo ${pendingEmail.correo} dejará de estar autorizado para crear cuentas.`
              : ''
          }
          onConfirm={() => void revokeEmail()}
          onOpenChange={(open) => {
            if (!open) setPendingEmail(null);
          }}
          open={pendingEmail !== null}
          title="Confirmar revocación de acceso"
        />
      </div>
    </AppFrame>
  );
}
