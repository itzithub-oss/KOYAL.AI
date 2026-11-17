"use client";

import styles from "./BootScreen.module.css";

export default function BootScreen() {
  return (
    <div className={styles.screen} role="status" aria-label="KOYAL AI is starting">
      <div className={styles.ambient} />
      <div className={styles.content}>
        <div className={styles.orbit}>
          <span className={styles.orbitRing} />
          <span className={styles.orbitRingInner} />
          <span className={styles.glow} />
          <img className={styles.bird} src="/koyal-bird.png" alt="KOYAL bird" />
        </div>

        <div className={styles.wordmark}>
          KOYAL <span>AI</span>
        </div>
        <div className={styles.tagline}>INTELLIGENCE WITH A SOFTER SOUL</div>

        <div className={styles.loader} aria-hidden="true">
          <span />
        </div>
        <div className={styles.loadingText}>AWAKENING</div>
      </div>
      <div className={styles.bottomLine} />
    </div>
  );
}
