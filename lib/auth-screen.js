import Link from 'next/link';
import Image from 'next/image';
import { LoginForm } from '../app/forms.js';

export function AuthScreen({ signup = false, nurse = false, googleStatus }) {
  const messages = {
    setup: 'Google sign-in is being configured. Contact the infirmary for help.',
    school: 'Choose your verified @msugensan.edu.ph Google account to continue.',
    failed: 'Google sign-in did not finish. Try again with your university account.'
  };
  return <main className="auth-split">
    <section className="auth-brand" aria-label="MERAYAG University Infirmary">
      <div className="auth-brand-content">
        <Image src="/merayag-brand.png" alt="MERAYAG phoenix and clinic emblem" width={1200} height={675} priority className="auth-artwork" />
        <p className="auth-name">MERAYAG</p>
        <p className="auth-caption">University Infirmary · {nurse ? 'Nurse Portal' : 'Student Portal'}</p>
      </div>
    </section>
    <section className="auth-form-area">
      <div className="auth-form-content">
        <header><h1>{nurse ? 'Log in as a nurse' : signup ? 'Create your account' : 'Welcome back'}</h1>
          <p>{nurse ? 'Use your nurse ID and password to open the clinic desk.' : signup ? 'Join MERAYAG with your university email.' : 'Log in to your MERAYAG student account.'}</p>
        </header>
        {typeof googleStatus === 'string' && Object.hasOwn(messages, googleStatus) &&
          <p className="error" role="alert">{messages[googleStatus]}</p>}
        <LoginForm signup={signup} password={!signup} nurse={nurse} />
        <div className="auth-switch">
          {nurse ? <Link href="/">Back to sign in</Link> : <>
            <div>{signup ? 'Already have an account? ' : 'Don’t have an account? '}
              <Link href={signup ? '/' : '/signup'}>{signup ? 'Log in' : 'Create one'}</Link>
            </div>
            {!signup && <Link className="nurse-login-link" href="/nurse-login">Log in as a nurse</Link>}
          </>}
        </div>
        <p className="auth-help">Need help? Contact the infirmary.</p>
      </div>
    </section>
  </main>;
}
