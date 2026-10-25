// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TherapistForm } from './therapist-form';

describe('TherapistForm', () => {
  it('validates a professional record and submits the selected weekly blocks', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<TherapistForm therapist={null} onCancel={vi.fn()} onSave={onSave} />);

    await user.type(screen.getByLabelText('Nombre completo'), 'Ana Terapeuta');
    await user.type(screen.getByLabelText('Teléfono'), '9991234567');
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@uady.mx');
    fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), {
      target: { value: '1985-06-15' },
    });
    await user.type(screen.getByLabelText('Cédula profesional (7–8 dígitos)'), '1234567');
    await user.click(screen.getByRole('checkbox', { name: 'Lunes' }));
    fireEvent.change(screen.getByLabelText('Lunes: hora inicial'), {
      target: { value: '07:30' },
    });

    const submit = screen.getByRole('button', { name: 'Registrar terapeuta' });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]?.[2]).toEqual([
      { dia_semana: 1, hora_inicio: '07:30', hora_fin: '17:00' },
    ]);
  });

  it('does not submit a professional license with fewer than seven digits', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<TherapistForm therapist={null} onCancel={vi.fn()} onSave={onSave} />);

    await user.type(screen.getByLabelText('Cédula profesional (7–8 dígitos)'), '123456');
    expect(screen.getByRole('button', { name: 'Registrar terapeuta' })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
