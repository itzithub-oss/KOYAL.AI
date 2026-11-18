"use client";

import { useEffect, useState } from "react";
import styles from "./BootScreen.module.css";

export default function BootScreen() {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setLeaving(true), 1650);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={`${styles.screen} ${leaving ? styles.leaving : ""}`} role="status" aria-label="KOYAL AI introduction">
      <div className={styles.glow} />
      <div className={styles.identity}>
        <img className={styles.logo} src="/koyal-bird.png" alt="" />
        <div className={styles.wordmark}>KOYAL <span>AI</span></div>
        <div className={styles.tagline}>A smarter way to think.</div>
      </div>
    </div>
  );
}
