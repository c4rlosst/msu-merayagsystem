import Link from 'next/link';
import Image from 'next/image';
import { LoginForm } from '../app/forms.js';
import AuthSwitch from '../components/ui/auth-switch.js';

const googleMessages = {
  setup: 'Google sign-in is being configured. Contact the infirmary for help.',
  school: 'Choose your verified @msugensan.edu.ph Google account to continue.',
  failed: 'Google sign-in did not finish. Try again with your university account.'
};

export function AuthScreen({ signup = false, nurse = false, googleStatus }) {
  if (!nurse) {
    return <AuthSwitch
      initialMode={signup ? 'signup' : 'signin'}
      notice={typeof googleStatus === 'string' && Object.hasOwn(googleMessages, googleStatus) &&
        <p className="error" role="alert">{googleMessages[googleStatus]}</p>}
      signInForm={<LoginForm password />}
      signUpForm={<LoginForm signup />}
      signInFooter={<Link href="/nurse-login">Log in as a nurse</Link>} />;
  }
  return <main className="auth-split">
    <section className="auth-brand" aria-label="MERAYAG University Infirmary">
      <div className="auth-brand-content">
        <Image src="/merayag-phoenix-light.png" alt="MERAYAG phoenix and clinic emblem" width={724} height={821}
          sizes="(max-width: 760px) 64px, 220px" priority className="auth-artwork" />
        <p className="auth-name">MERAYAG</p>
        <p className="auth-caption">University Infirmary · Nurse Portal</p>
      </div>
    </section>
    <section className="auth-form-area">
      <div className="auth-form-content">
        <header><h1>Log in as a nurse</h1>
          <p>Use your nurse ID and password to open the clinic desk.</p>
        </header>
        <LoginForm password nurse />
        <div className="auth-switch"><Link href="/">Back to sign in</Link></div>
        <p className="auth-help">Need help? Contact the infirmary.</p>
      </div>
    </section>
  </main>;
}
