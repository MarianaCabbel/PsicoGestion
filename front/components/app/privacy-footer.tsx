import Link from 'next/link';
import { PRIVACY_NOTICE_VERSION } from '@/lib/privacy';

export function PrivacyFooter() {
  return (
    <footer className="app-footer">
      <span>PsicoGestión · Protección de datos personales</span>
      <Link href="/privacidad">Aviso de privacidad {PRIVACY_NOTICE_VERSION}</Link>
    </footer>
  );
}
