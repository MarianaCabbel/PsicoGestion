'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useSession } from '@/components/providers/session-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { api, ApiError } from '@/lib/api';

function LoginForm({ method }: { method: 'email' | 'phone' }) {
  const router = useRouter();
  const { refresh } = useSession();
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/api/auth/' + (method === 'email' ? 'login' : 'login-telefono'), {
        method: 'POST',
        redirectOnUnauthorized: false,
        body: {
          [method === 'email' ? 'correo_institucional' : 'telefono']: identity,
          password,
        },
      });
      await refresh();
      router.replace('/panel');
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) {
        const query = method === 'email' ? `?correo=${encodeURIComponent(identity)}` : '';
        router.push(`/verificar${query}`);
      }
      toast.error(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={(event) => void submit(event)}>
      <Input
        autoComplete={method === 'email' ? 'username' : 'tel'}
        label={method === 'email' ? 'Correo institucional' : 'Teléfono'}
        name={method === 'email' ? 'correo_institucional' : 'telefono'}
        onChange={(event) => setIdentity(event.target.value)}
        placeholder={method === 'email' ? 'nombre@uady.mx' : '999 123 4567'}
        required
        type={method === 'email' ? 'email' : 'tel'}
        value={identity}
      />
      <Input
        autoComplete="current-password"
        label="Contraseña"
        name="password"
        onChange={(event) => setPassword(event.target.value)}
        required
        type="password"
        value={password}
      />
      <div className="auth-inline-links">
        <Link href="/recuperar">¿Olvidaste tu contraseña?</Link>
      </div>
      <Button className="auth-submit" disabled={busy} type="submit">
        {busy ? 'Validando…' : 'Iniciar sesión'}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  const items: TabItem[] = [
    { id: 'email', label: 'Correo', content: <LoginForm method="email" /> },
    { id: 'phone', label: 'Teléfono', content: <LoginForm method="phone" /> },
  ];

  return (
    <Card className="auth-card-modern">
      <CardHeader className="auth-card-header">
        <span className="auth-logo" aria-hidden="true">
          P
        </span>
        <p className="auth-eyebrow">PsicoGestión · SEAP</p>
        <h1>Bienvenida, bienvenido</h1>
        <p>Ingresa a tu espacio de trabajo.</p>
      </CardHeader>
      <CardContent>
        <Tabs ariaLabel="Método de acceso" items={items} />
        <p className="auth-footnote">
          ¿Aún no tienes cuenta? <Link href="/registro">Crear cuenta</Link>
        </p>
      </CardContent>
    </Card>
  );
}
