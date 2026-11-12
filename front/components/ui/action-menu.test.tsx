// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActionMenu } from './action-menu';

describe('ActionMenu', () => {
  it('abre el menú, ejecuta la acción elegida y se cierra', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(
      <ActionMenu
        items={[
          { label: 'Editar', onSelect: onEdit },
          { label: 'Eliminar', onSelect: vi.fn(), variant: 'danger' },
        ]}
        label="Acciones para Sala A"
      />,
    );

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Acciones para Sala A' }));
    expect(screen.getByRole('menu', { name: 'Acciones para Sala A' })).toBeVisible();

    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('se cierra al hacer clic fuera o presionar Escape', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <ActionMenu
          items={[{ label: 'Editar', onSelect: vi.fn() }]}
          label="Acciones para Sala A"
        />
        <button type="button">Fuera</button>
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'Acciones para Sala A' }));
    expect(screen.getByRole('menu')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Fuera' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Acciones para Sala A' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
