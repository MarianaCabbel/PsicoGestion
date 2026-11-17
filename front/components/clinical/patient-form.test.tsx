// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PatientForm } from './patient-form';
import { curpCheckDigit } from '@/lib/clinical-validation';

function validCurp() {
  const alphabet = 'BCDFGHJKLMNPQRSTVWXYZ';
  const consonants = [0, 7, 14].map((index) => alphabet[index]).join('');
  const base = `AEAG900427HYN${consonants}0`;
  return `${base}${curpCheckDigit(base)}`;
}

describe('PatientForm', () => {
  it('autocompletes CURP data and requires explicit privacy consent before submit', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PatientForm patient={null} onCancel={vi.fn()} onSave={onSave} />);

    await user.type(screen.getByLabelText('Nombre'), 'María');
    await user.type(screen.getByLabelText('Apellido paterno'), 'Pérez');
    await user.type(screen.getByLabelText('Apellido materno'), 'López');
    fireEvent.change(screen.getByLabelText('CURP'), { target: { value: validCurp() } });

    await waitFor(() => {
      expect(screen.getByLabelText('Fecha de nacimiento')).toHaveValue('1990-04-27');
      expect(screen.getByLabelText('Sexo')).toHaveValue('H');
    });
    await user.type(screen.getByLabelText('Teléfono'), '9991234567');
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@uady.mx');

    const submit = screen.getByRole('button', { name: 'Registrar paciente' });
    expect(submit).toBeDisabled();
    await user.click(
      screen.getByRole('checkbox', {
        name: /leí y acepto el aviso de privacidad/i,
      }),
    );
    await user.click(submit);

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      curp: validCurp(),
      fecha_nacimiento: '1990-04-27',
      acepta_aviso: true,
    });
  });

  it('abre el aviso de privacidad en el mismo formulario y vuelve conservando los datos', async () => {
    const user = userEvent.setup();
    render(<PatientForm patient={null} onCancel={vi.fn()} onSave={vi.fn()} />);

    await user.type(screen.getByLabelText('Nombre'), 'María');
    await user.type(screen.getByLabelText('Apellido paterno'), 'Pérez');
    await user.type(screen.getByLabelText('Teléfono'), '9991234567');

    await user.click(screen.getByRole('link', { name: /aviso de privacidad/i }));

    const privacySection = await screen.findByRole('region', {
      name: /aviso de privacidad v1\.0/i,
    });
    expect(privacySection).toBeVisible();
    expect(
      within(privacySection).getByRole('heading', {
        name: 'Derechos ARCO y revocación del consentimiento',
      }),
    ).toBeVisible();

    await user.click(
      within(privacySection).getByRole('button', { name: 'Volver al registro de paciente' }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: /aviso de privacidad v1\.0/i }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Nombre')).toHaveValue('María');
    expect(screen.getByLabelText('Apellido paterno')).toHaveValue('Pérez');
    expect(screen.getByLabelText('Teléfono')).toHaveValue('9991234567');
  });
});
