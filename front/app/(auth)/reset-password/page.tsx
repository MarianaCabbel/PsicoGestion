'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

type ResetValues = {
  nueva_password: string;
  confirmar_password: string;
};

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [values, setValues] = useState<ResetValues>({
    nueva_password: '',
    confirmar_password: '',
  });
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/api/auth/restablecer', {
        method: 'POST',
        redirectOnUnauthorized: false,
        body: { token, ...values },
      });
      setSubmitted(true);
      toast.success('La contraseña se restableció correctamente.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo restablecer la contraseña.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="auth-card-modern">
      <CardHeader className="auth-card-header">
        <Link className="auth-back-link" href="/login">
          ← Volver al acceso
        </Link>
        <p className="auth-eyebrow">Seguridad de tu cuenta</p>
        <h1>Nueva contraseña</h1>
        <p>Elige una contraseña segura para continuar.</p>
      </CardHeader>
      <CardContent>
        {submitted ? (
          <div className="auth-success" role="status">
            <h2>Contraseña actualizada</h2>
            <p>Ya puedes entrar usando tu nueva contraseña.</p>
            <Link href="/login">Ir a iniciar sesión</Link>
          </div>
        ) : (
          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            <Input
              autoComplete="new-password"
              label="Nueva contraseña"
              name="nueva_password"
              onChange={(event) =>
                setValues((current) => ({ ...current, nueva_password: event.target.value }))
              }
              required
              type="password"
              value={values.nueva_password}
            />
            <p className="auth-help">
              8–25 caracteres, una mayúscula, un número y un carácter especial.
            </p>
            <Input
              autoComplete="new-password"
              label="Confirmar contraseña"
              name="confirmar_password"
              onChange={(event) =>
                setValues((current) => ({ ...current, confirmar_password: event.target.value }))
              }
              required
              type="password"
              value={values.confirmar_password}
            />
            <Button className="auth-submit" disabled={busy || !token} type="submit">
              {busy ? 'Actualizando…' : 'Guardar contraseña'}
            </Button>
            {!token && (
              <p className="ui-field-error" role="alert">
                El enlace no contiene un token válido.
              </p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
