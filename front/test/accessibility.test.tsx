// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import axe from 'axe-core';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import PrivacyNoticePage from '@/app/privacidad/page';
import { PatientForm } from '@/components/clinical/patient-form';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

afterEach(cleanup);

async function checkAccessibility() {
  return axe.run(document.body, {
    runOnly: { type: 'tag', values: wcagTags },
    rules: { 'color-contrast': { enabled: false } },
  });
}

describe('Accesibilidad WCAG 2.1 AA', () => {
  it('no presenta violaciones axe en el aviso público', async () => {
    render(<PrivacyNoticePage />);
    const result = await checkAccessibility();
    expect(
      result.violations.map(({ id, impact, nodes }) => ({ id, impact, count: nodes.length })),
    ).toEqual([]);
  });

  it('no presenta violaciones axe en el formulario de expediente', async () => {
    render(
      <main aria-label="Registro de paciente">
        <PatientForm patient={null} onCancel={() => undefined} onSave={async () => undefined} />
      </main>,
    );
    const result = await checkAccessibility();
    expect(
      result.violations.map(({ id, impact, nodes }) => ({ id, impact, count: nodes.length })),
    ).toEqual([]);
  });
});
