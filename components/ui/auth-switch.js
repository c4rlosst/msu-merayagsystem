'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import styles from './auth-switch.module.css';

function SwitchPanel({ side, heading, text, action, onAction, inert }) {
  return <div className={`${styles.panel} ${side === 'left' ? styles.leftPanel : styles.rightPanel}`} inert={inert}>
    <div className={styles.panelContent}>
      <Image src="/merayag-phoenix-light.png" alt="" width={724} height={821} sizes="112px" priority className={styles.logo} />
      <h2>{heading}</h2>
      <p>{text}</p>
      <button type="button" className={styles.ghostButton} onClick={onAction}>{action}</button>
    </div>
  </div>;
}

/**
 * Sliding sign-in / sign-up card. The forms themselves are passed in so their
 * server actions and validation stay in one place (app/forms.js).
 */
export default function AuthSwitch({ initialMode = 'signin', notice, signInForm, signUpForm, signInFooter }) {
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
      ?.querySelector('input:not([type="hidden"])')?.focus({ preventScroll: true });
  }, [isSignUp]);

  return <main className={styles.root}>
    <div className={isSignUp ? `${styles.card} ${styles.signUpMode}` : styles.card}>
      <div className={styles.formsContainer}>
        <div className={styles.track}>
          <section ref={signInPane} className={`${styles.pane} ${styles.signInPane}`} inert={isSignUp}
            aria-label="Log in">
            <p className={styles.eyebrow}>MERAYAG University Infirmary · Student portal</p>
            <h1 className={styles.title}>Welcome back</h1>
            <p className={styles.lead}>Log in to your MERAYAG student account.</p>
            {notice}
            {signInForm}
            {signInFooter && <div className={styles.footer}>{signInFooter}</div>}
            <p className={styles.help}>Need help? Contact the infirmary.</p>
          </section>

          <section ref={signUpPane} className={`${styles.pane} ${styles.signUpPane}`} inert={!isSignUp}
            aria-label="Create account">
            <p className={styles.eyebrow}>MERAYAG University Infirmary · Student portal</p>
            <h1 className={styles.title}>Create your account</h1>
            <p className={styles.lead}>Join MERAYAG with your university email.</p>
            {signUpForm}
            <p className={styles.help}>Need help? Contact the infirmary.</p>
          </section>
        </div>
      </div>

      <div className={styles.panels}>
        <SwitchPanel side="left" inert={isSignUp} heading="New here?"
          text="Create your account with your university email to book clinic visits."
          action="Create account" onAction={() => switchTo(true)} />
        <SwitchPanel side="right" inert={!isSignUp} heading="One of us?"
          text="Welcome back! Log in to see your appointments and clinic updates."
          action="Log in" onAction={() => switchTo(false)} />
      </div>
    </div>
  </main>;
}
