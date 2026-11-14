import Link from 'next/link';
import Image from 'next/image';
import { LoginForm } from '../app/forms.js';
import AuthSwitch from '../components/ui/auth-switch.js';
import { schoolDomains } from './google-auth.js';

const googleMessages = {
  setup: 'Google sign-in is being configured. Contact the infirmary for help.',
  school: 'Choose your verified @msugensan.edu.ph Google account to continue.',
  failed: 'Google sign-in did not finish. Try again with your university account.'
};

export function AuthScreen({ signup = false, nurse = false, googleStatus, notice }) {
  if (!nurse) {
    const domains = schoolDomains();
    const emailDomain = domains.length === 1 ? domains[0] : undefined; // several domains: keep a free-form field
    return <AuthSwitch
      initialMode={signup ? 'signup' : 'signin'}
      notice={typeof googleStatus === 'string' && Object.hasOwn(googleMessages, googleStatus) &&
        <p className="error" role="alert">{googleMessages[googleStatus]}</p>}
      signInForm={<LoginForm password emailDomain={emailDomain} />}
      googleHref="/auth/google"
      schoolDomain={emailDomain}
      signInFooter={<Link href="/nurse-login">Staff log in</Link>} />;
  }
  return <main className="auth-split">
    <BrandPanel portal="Staff Portal" />
    <section className="auth-form-area">
      <div className="auth-form-content">
        <header><h1>Staff log in</h1>
          <p>Nurses and administrators: use your staff ID and password.</p>
        </header>
        {notice && <p role="status" className="success">{notice}</p>}
        <LoginForm password nurse />
        <div className="auth-switch"><Link href="/">Back to student sign in</Link></div>
        <p className="auth-help">Need help? Contact the infirmary.</p>
      </div>
    </section>
  </main>;
}

function BrandPanel({ portal }) {
  return <section className="auth-brand" aria-label="MERAYAG University Infirmary">
    <div className="auth-brand-content">
      <Image src="/merayag-phoenix-panel.png" alt="MERAYAG phoenix and clinic emblem" width={689} height={1000}
        sizes="(max-width: 760px) 64px, 220px" priority className="auth-artwork" />
      <p className="auth-name">MERAYAG</p>
      <p className="auth-caption">University Infirmary · {portal}</p>
    </div>
  </section>;
}
