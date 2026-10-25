'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

const CODE_LIFETIME_SECONDS = 10 * 60;

export default function VerificationPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(CODE_LIFETIME_SECONDS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEmail(new URLSearchParams(window.location.search).get('correo') ?? '');
  }, []);

  useEffect(() => {
    const key = 'psicogestion-verification-expiration';
    const stored = window.sessionStorage.getItem(key);
    const expiration = stored ? Number(stored) : Date.now() + CODE_LIFETIME_SECONDS * 1000;
    if (!stored || !Number.isFinite(expiration)) {
      window.sessionStorage.setItem(key, String(Date.now() + CODE_LIFETIME_SECONDS * 1000));
    }
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiration - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/api/auth/verificar', {
        method: 'POST',
        redirectOnUnauthorized: false,
        body: { correo_institucional: email, codigo_verificacion: code },
      });
      window.sessionStorage.removeItem('psicogestion-verification-expiration');
      toast.success('Cuenta verificada. Ya puedes iniciar sesión.');
      window.location.assign('/login');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo verificar la cuenta.');
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    try {
      await api('/api/auth/reenviar-codigo', {
        method: 'POST',
        redirectOnUnauthorized: false,
        body: { correo_institucional: email },
      });
      const expiration = Date.now() + CODE_LIFETIME_SECONDS * 1000;
      window.sessionStorage.setItem('psicogestion-verification-expiration', String(expiration));
      setSecondsLeft(CODE_LIFETIME_SECONDS);
      toast.success('Si la cuenta está pendiente, enviamos un código nuevo.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo solicitar otro código.');
    }
  }

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  return (
    <Card className="auth-card-modern">
      <CardHeader className="auth-card-header">
        <Link className="auth-back-link" href="/login">
          ← Volver al acceso
        </Link>
        <p className="auth-eyebrow">Un paso más</p>
        <h1>Verifica tu correo</h1>
        <p>Escribe el código de 6 dígitos que enviamos a tu correo institucional.</p>
      </CardHeader>
      <CardContent>
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
          <Input
            autoComplete="one-time-code"
            inputMode="numeric"
            label="Código de verificación"
            maxLength={6}
            minLength={6}
            name="codigo_verificacion"
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            pattern="[0-9]{6}"
            required
            value={code}
          />
          <p className="verification-countdown" aria-live="polite">
            {secondsLeft > 0
              ? `El código vence en ${minutes}:${seconds}`
              : 'El código venció. Solicita uno nuevo.'}
          </p>
          <Button className="auth-submit" disabled={busy} type="submit">
            {busy ? 'Verificando…' : 'Verificar cuenta'}
          </Button>
        </form>
        <Button
          className="auth-resend"
          disabled={!email}
          onClick={() => void resendCode()}
          variant="ghost"
        >
          Reenviar código
        </Button>
      </CardContent>
    </Card>
  );
}
