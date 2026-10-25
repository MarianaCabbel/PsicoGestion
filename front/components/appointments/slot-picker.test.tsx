// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SlotPicker } from './slot-picker';

describe('SlotPicker', () => {
  it('selects an available time and reports its room options', () => {
    const onChange = vi.fn();
    render(
      <SlotPicker
        onChange={onChange}
        starts={[
          {
            hora_inicio: '09:00',
            hora_fin: '10:00',
            salas_libres: [{ id: 2, nombre: 'Consultorio 2' }],
          },
        ]}
        value=""
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '09:00–10:00' }));

    expect(onChange).toHaveBeenCalledWith({
      hora_inicio: '09:00',
      hora_fin: '10:00',
      salas_libres: [{ id: 2, nombre: 'Consultorio 2' }],
    });
  });
});
