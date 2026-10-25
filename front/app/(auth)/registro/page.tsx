'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

type Registration = {
  nombre_completo: string;
  correo_institucional: string;
  telefono: string;
  password: string;
  confirmar_password: string;
};

const initialValues: Registration = {
  nombre_completo: '',
  correo_institucional: '',
  telefono: '',
  password: '',
  confirmar_password: '',
};

export default function RegistrationPage() {
  const [values, setValues] = useState(initialValues);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  function update(field: keyof Registration, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/api/auth/registro', {
        method: 'POST',
        body: values,
        redirectOnUnauthorized: false,
      });
      toast.success('Cuenta creada. Revisa tu correo para obtener el código de verificación.');
      router.push(`/verificar?correo=${encodeURIComponent(values.correo_institucional)}`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo crear la cuenta.');
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
        <p className="auth-eyebrow">Únete al equipo</p>
        <h1>Crear cuenta</h1>
        <p>Usa tu correo institucional de la UADY.</p>
      </CardHeader>
      <CardContent>
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <Input
            autoComplete="name"
            label="Nombre completo"
            name="nombre_completo"
            onChange={(event) => update('nombre_completo', event.target.value)}
            required
            value={values.nombre_completo}
          />
          <Input
            autoComplete="email"
            label="Correo institucional"
            name="correo_institucional"
            onChange={(event) => update('correo_institucional', event.target.value)}
            required
            type="email"
            value={values.correo_institucional}
          />
          <Input
            autoComplete="tel"
            label="Teléfono (10 dígitos)"
            maxLength={10}
            name="telefono"
            onChange={(event) => update('telefono', event.target.value)}
            pattern="[0-9]{10}"
            required
            type="tel"
            value={values.telefono}
          />
          <Input
            autoComplete="new-password"
            label="Contraseña"
            name="password"
            onChange={(event) => update('password', event.target.value)}
            required
            type="password"
            value={values.password}
          />
          <p className="auth-help">
            8–25 caracteres, una mayúscula, un número y un carácter especial.
          </p>
          <Input
            autoComplete="new-password"
            label="Confirmar contraseña"
            name="confirmar_password"
            onChange={(event) => update('confirmar_password', event.target.value)}
            required
            type="password"
            value={values.confirmar_password}
          />
          <Button className="auth-submit" disabled={busy} type="submit">
            {busy ? 'Creando cuenta…' : 'Crear cuenta'}
          </Button>
        </form>
        <p className="auth-footnote">
          ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
        </p>
      </CardContent>
    </Card>
  );
}
