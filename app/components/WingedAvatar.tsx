"use client";

import styles from "../koyal-final.module.css";

type WingedAvatarProps = {
  photo?: string;
  supreme: boolean;
  variant?: "small" | "large";
};

export default function WingedAvatar({ photo, supreme, variant = "small" }: WingedAvatarProps) {
  const isLarge = variant === "large";
  return (
    <div className={`${styles.wingedAvatar} ${isLarge ? styles.wingedLarge : styles.wingedSmall}`}>
      {supreme && <>
        <img src="/koyal-profile-wing.svg" alt="" aria-hidden="true" className={`${styles.avatarWing} ${styles.wingLeft}`} />
        <img src="/koyal-profile-wing.svg" alt="" aria-hidden="true" className={`${styles.avatarWing} ${styles.wingRight}`} />
      </>}
      <div className={styles.avatarPhotoRing}>
        <img src={photo || "/koyal-bird.png"} alt={photo ? "Profile photograph" : "Default Koyal bird avatar"} className={styles.avatarPhoto}/>
      </div>
    </div>
  );
}
