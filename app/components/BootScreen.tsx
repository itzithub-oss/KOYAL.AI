"use client";

import { useEffect, useState } from "react";
import styles from "./BootScreen.module.css";

export default function BootScreen() {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setLeaving(true), 12600);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={`${styles.screen} ${leaving ? styles.leaving : ""}`} role="status" aria-label="KOYAL AI cinematic introduction">
      <div className={styles.sky} />
      <div className={styles.building}>
        <div className={styles.buildingTop}>KOYAL HOUSE</div>
        <div className={styles.buildingWindow}>
          <div className={styles.room}>
            <div className={styles.curtainLeft} />
            <div className={styles.curtainRight} />
            <div className={styles.man}>
              <span className={styles.manHead} />
              <span className={styles.manBody} />
              <span className={styles.manArm} />
            </div>
            <span className={styles.hand} />
            <span className={styles.kiss} />
            <img className={styles.handBird} src="/koyal-bird.png" alt="" />
          </div>
          <span className={styles.windowCrossV} />
          <span className={styles.windowCrossH} />
        </div>
        <div className={styles.windowGlow} />
      </div>

      <div className={styles.outdoor}>
        <div className={styles.moon} />
        <div className={`${styles.cloud} ${styles.cloudOne}`} />
        <div className={`${styles.cloud} ${styles.cloudTwo}`} />
        <div className={styles.hills} />
        <div className={styles.tree}>
          <span className={styles.trunk} />
          <span className={styles.branch} />
          <span className={styles.leaves} />
        </div>
      </div>

      <img className={styles.flyingBird} src="/koyal-bird.png" alt="" />
      <img className={styles.perchedBird} src="/koyal-bird.png" alt="" />

      <div className={styles.eyeZoom}>
        <img src="/koyal-bird.png" alt="" />
      </div>

      <div className={styles.brand}>
        <div className={styles.brandName}>KOYAL <span>AI</span></div>
        <div className={styles.brandLine}>A SOFTER SOUL. A BRIGHTER MIND.</div>
      </div>
      <div className={styles.introHint}>A little story before we begin</div>
      <div className={styles.fadeOut} />
    </div>
  );
}
