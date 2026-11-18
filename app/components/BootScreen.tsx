"use client";

import { useEffect, useState } from "react";
import styles from "./BootScreen.module.css";

export default function BootScreen() {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setLeaving(true), 2150);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={`${styles.screen} ${leaving ? styles.leaving : ""}`} role="status" aria-label="KOYAL AI awakening">
      <div className={styles.glow} />
      <div className={styles.identity}>
        <div className={styles.logoStage}>
          <div className={styles.orbit} aria-hidden="true">
            <span className={styles.orbitSpark} />
          </div>
          <img className={styles.logo} src="/koyal-bird.png" alt="KOYAL" />
        </div>
        <div className={styles.tagline}>Awakening<span className={styles.ellipsis}>...</span></div>
      </div>
    </div>
  );
}
