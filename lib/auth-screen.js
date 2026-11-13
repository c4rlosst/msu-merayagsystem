import Link from 'next/link';
import Image from 'next/image';
import { LoginForm } from '../app/forms.js';

export function AuthScreen({ signup = false }) {
  return <main className="auth-split">
    <section className="auth-brand" aria-label="MERAYAG University Infirmary">
      <div className="auth-brand-content">
        <Image src="/merayag-brand.png" alt="MERAYAG phoenix and clinic emblem" width={1200} height={675} priority className="auth-artwork" />
        <p className="auth-name">MERAYAG</p>
        <p className="auth-caption">University Infirmary · Student Portal</p>
      </div>
    </section>
    <section className="auth-form-area">
      <div className="auth-form-content">
        <header><h1>{signup ? 'Create your account' : 'Welcome back'}</h1>
          <p>{signup ? 'Join MERAYAG with your university email.' : 'Log in to your MERAYAG student account.'}</p>
        </header>
        <LoginForm signup={signup} />
        <p className="auth-verification">We’ll email you a verification code to securely access your clinic account.</p>
        <p className="auth-switch">{signup ? 'Already have an account? ' : 'Don’t have an account? '}
          <Link href={signup ? '/' : '/signup'}>{signup ? 'Log in' : 'Create one'}</Link>
        </p>
        <p className="auth-help">Need help? Contact the infirmary.</p>
      </div>
    </section>
  </main>;
}
