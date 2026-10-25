// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PrivacyNoticePage from './page';

describe('PrivacyNoticePage', () => {
  it('publishes a versioned privacy notice with ARCO information', () => {
    render(<PrivacyNoticePage />);
    expect(screen.getByRole('heading', { name: 'Aviso de privacidad' })).toBeVisible();
    expect(screen.getByText(/Versión v1\.0/)).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Derechos ARCO y revocación del consentimiento' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Aviso de privacidad v1.0' })).toBeVisible();
  });
});
