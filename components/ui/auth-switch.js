'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ShaderBackground } from './mesh-gradient';
import styles from './auth-switch.module.css';

function SwitchPanel({ side, heading, text, action, onAction, inert }) {
  return <div className={`${styles.panel} ${side === 'left' ? styles.leftPanel : styles.rightPanel}`} inert={inert}>
    <div className={styles.panelContent}>
      <Image src="/merayag-phoenix-panel.png" alt="" width={689} height={1000} sizes="128px" priority className={styles.logo} />
      <h2>{heading}</h2>
      <p>{text}</p>
      <button type="button" className={styles.ghostButton} onClick={onAction}>{action}</button>
    </div>
  </div>;
}

// A plain link, not a form: /auth/google redirects to Google, which proves the student owns the address.
function GoogleButton({ href, label }) {
  return <a href={href} className={styles.googleButton}>
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
    {label}
  </a>;
}

/**
 * Sliding sign-in / sign-up card. The sign-in form is passed in so its server action and
 * validation stay in one place (app/forms.js). With `googleHref`, both sides offer Google
 * sign-in and the sign-up side is Google only (no passwords or email codes).
 */
export default function AuthSwitch({ initialMode = 'signin', notice, signInForm, signUpForm, signInFooter, googleHref, schoolDomain }) {
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
  const signInPane = useRef(null);
  const signUpPane = useRef(null);
  const moveFocus = useRef(false);

  function switchTo(signUp) {
    moveFocus.current = true;
    setIsSignUp(signUp);
    // Keep the address bar honest so refresh/share lands on the same side.
    window.history.replaceState(null, '', signUp ? '/signup' : '/');
  }

  // The pane that just became visible is no longer inert; hand keyboard focus to it.
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (isSignUp ? signUpPane : signInPane).current
      ?.querySelector('a[href], input:not([type="hidden"])')?.focus({ preventScroll: true });
  }, [isSignUp]);

  return <main className={styles.root}>
    <div className={styles.backdrop} aria-hidden="true"><ShaderBackground /></div>
    <div className={isSignUp ? `${styles.card} ${styles.signUpMode}` : styles.card}>
      <div className={styles.formsContainer}>
        <div className={styles.track}>
          <section ref={signInPane} className={`${styles.pane} ${styles.signInPane}`} inert={isSignUp}
            aria-label="Log in">
            <p className={styles.eyebrow}>MERAYAG University Infirmary · Student portal</p>
            <h1 className={styles.title}>Welcome back</h1>
            <p className={styles.lead}>Log in to your MERAYAG student account.</p>
            {notice}
            {googleHref && <>
              <GoogleButton href={googleHref} label="Continue with Google" />
              <p className={styles.divider}>or use your clinic password</p>
            </>}
            {signInForm}
            {signInFooter && <div className={styles.footer}>{signInFooter}</div>}
            <p className={styles.help}>Need help? Contact the infirmary.</p>
          </section>

          <section ref={signUpPane} className={`${styles.pane} ${styles.signUpPane}`} inert={!isSignUp}
            aria-label="Create account">
            <p className={styles.eyebrow}>MERAYAG University Infirmary · Student portal</p>
            <h1 className={styles.title}>Create your account</h1>
            {googleHref ? <>
              <p className={styles.lead}>Sign up with your university Google account. No password or email code needed.</p>
              <GoogleButton href={googleHref} label="Sign up with Google" />
              {schoolDomain && <p className={styles.note}>Use your @{schoolDomain} account.</p>}
            </> : <>
              <p className={styles.lead}>Join MERAYAG with your university email.</p>
              {signUpForm}
            </>}
            <p className={styles.help}>Need help? Contact the infirmary.</p>
          </section>
        </div>
      </div>

      <div className={styles.panels}>
        <SwitchPanel side="left" inert={isSignUp} heading="New here?"
          text="Sign up with your university Google account to book clinic visits."
          action="Create account" onAction={() => switchTo(true)} />
        <SwitchPanel side="right" inert={!isSignUp} heading="One of us?"
          text="Welcome back! Log in to see your appointments and clinic updates."
          action="Log in" onAction={() => switchTo(false)} />
      </div>
    </div>
  </main>;
}
