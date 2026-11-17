import { PrivacyBackLink } from '@/components/app/privacy-back-link';
import { PrivacyFooter } from '@/components/app/privacy-footer';
import { PrivacyNoticeContent } from '@/components/app/privacy-notice';
import { PRIVACY_NOTICE_VERSION } from '@/lib/privacy';

export const metadata = {
  title: `Aviso de privacidad ${PRIVACY_NOTICE_VERSION} | PsicoGestión`,
  description: 'Aviso de privacidad para el tratamiento de datos en PsicoGestión.',
};

export default function PrivacyNoticePage() {
  return (
    <main className="privacy-page">
      <header className="privacy-heading">
        <p className="eyebrow">PsicoGestión · Protección de datos</p>
        <h1>Aviso de privacidad</h1>
        <p>Versión {PRIVACY_NOTICE_VERSION} · Vigente desde el 25 de octubre de 2026</p>
      </header>

      <PrivacyNoticeContent actions={<PrivacyBackLink />} />
      <PrivacyFooter />
    </main>
  );
}
