'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

export default function RecoveryPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await api<undefined>('/api/auth/recuperar', {
        method: 'POST',
        redirectOnUnauthorized: false,
        body: { correo_institucional: email },
      });
      setSubmitted(true);
      toast.success(response.message);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo solicitar la recuperación.');
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
        <p className="auth-eyebrow">Recuperación de acceso</p>
        <h1>Restablecer contraseña</h1>
        <p>Te enviaremos un enlace para crear una contraseña nueva.</p>
      </CardHeader>
      <CardContent>
        {submitted ? (
          <div className="auth-success" role="status">
            <h2>Revisa tu correo</h2>
            <p>Si la cuenta existe, recibirás instrucciones para restablecer tu contraseña.</p>
          </div>
        ) : (
          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            <Input
              autoComplete="email"
              label="Correo institucional"
              name="correo_institucional"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
            <Button className="auth-submit" disabled={busy} type="submit">
              {busy ? 'Enviando…' : 'Enviar instrucciones'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
