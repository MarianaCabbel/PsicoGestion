import Link from 'next/link';
import { PrivacyFooter } from '@/components/app/privacy-footer';
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

      <article className="privacy-content">
        <section>
          <h2>Responsable</h2>
          <p>
            La instancia administradora del servicio de atención psicológica (SEAP) de la
            Universidad Autónoma de Yucatán es responsable del tratamiento de los datos personales
            incorporados en PsicoGestión.
          </p>
        </section>
        <section>
          <h2>Datos que se tratan</h2>
          <p>
            Para gestionar expedientes y citas se pueden tratar nombre, CURP, sexo, fecha de
            nacimiento, teléfono, correo electrónico, datos de contacto del personal autorizado,
            horarios y datos operativos de las citas. La aplicación registra también acciones de
            acceso y administración para fines de control y seguridad.
          </p>
        </section>
        <section>
          <h2>Finalidades</h2>
          <ul>
            <li>Administrar expedientes, agenda, citas, salas y comunicaciones relacionadas.</li>
            <li>Verificar y gestionar el acceso del personal autorizado.</li>
            <li>Proteger la información y mantener una bitácora de operaciones administrativas.</li>
            <li>Generar estadísticas de operación con información anonimizada.</li>
          </ul>
        </section>
        <section>
          <h2>Conservación y seguridad</h2>
          <p>
            El acceso está limitado a personal autenticado según su rol. Las sesiones usan cookies
            protegidas y la bitácora evita almacenar valores de datos personales en el detalle de
            las operaciones. Los expedientes se conservan conforme a las políticas institucionales
            aplicables. La anonimización reemplaza los datos identificables y conserva los registros
            de cita necesarios para estadísticas.
          </p>
        </section>
        <section>
          <h2>Derechos ARCO y revocación del consentimiento</h2>
          <p>
            La persona titular, o su representante acreditado, puede solicitar acceso,
            rectificación, cancelación u oposición, así como la revocación del consentimiento, ante
            la administración del SEAP por los canales institucionales de atención. La procedencia y
            atención de cada solicitud se sujetan a la legislación y a las políticas institucionales
            aplicables. La cancelación puede estar limitada cuando exista una obligación de
            conservación.
          </p>
        </section>
        <section>
          <h2>Transferencias y cambios al aviso</h2>
          <p>
            Los datos se utilizan para las finalidades descritas y no se destinan a publicidad. Si
            se requiere una transferencia adicional, se informará conforme a las reglas
            institucionales aplicables. Esta versión puede actualizarse; la versión vigente estará
            publicada en esta página.
          </p>
        </section>
        <p className="privacy-version">
          Este aviso es la versión publicada en PsicoGestión. Para orientación sobre el ejercicio de
          derechos, contacta a la administración del SEAP en los canales institucionales.
        </p>
        <Link className="ui-button ui-button--secondary ui-button--md" href="/login">
          Volver al acceso
        </Link>
      </article>
      <PrivacyFooter />
    </main>
  );
}
