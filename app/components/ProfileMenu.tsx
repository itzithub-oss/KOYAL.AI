"use client";

import { useEffect, useState } from "react";
import SubscriptionModal from "./SubscriptionModal";

type PlanName = "Just" | "Let It" | "Care" | "Elite" | "Supreme";

type Profile = {
  name: string;
  dob: string;
  gender: string;
  phone: string;
};

type ProfileModalProps = {
  open: boolean;
  onClose: () => void;
};

const PLAN_PRICES: Record<PlanName, number> = {
  Just: 0,
  "Let It": 70,
  Care: 120,
  Elite: 220,
  Supreme: 400,
};

export default function ProfileModal({
  open,
  onClose,
}: ProfileModalProps) {
  const [profile, setProfile] = useState<Profile>({
    name: "",
    dob: "",
    gender: "",
    phone: "",
  });

  const [subscriptionPlan, setSubscriptionPlan] =
    useState<PlanName>("Just");

  const [subscriptionOpen, setSubscriptionOpen] =
    useState(false);

  // LOAD PROFILE + SUBSCRIPTION
  useEffect(() => {
    if (!open) return;

    try {
      const savedProfile = localStorage.getItem(
        "koyal-ai-profile"
      );

      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);

        setProfile({
          name: parsed.name || "",
          dob: parsed.dob || "",
          gender: parsed.gender || "",
          phone: parsed.phone || "",
        });
      }
    } catch (error) {
      console.error("Could not load profile:", error);
    }

    loadSubscription();
  }, [open]);

  // LISTEN FOR SUBSCRIPTION CHANGES
  useEffect(() => {
    function handleSubscriptionChange() {
      loadSubscription();
    }

    window.addEventListener(
      "koyal-subscription-changed",
      handleSubscriptionChange
    );

    window.addEventListener(
      "storage",
      handleSubscriptionChange
    );

    return () => {
      window.removeEventListener(
        "koyal-subscription-changed",
        handleSubscriptionChange
      );

      window.removeEventListener(
        "storage",
        handleSubscriptionChange
      );
    };
  }, []);

  function loadSubscription() {
    const savedPlan = localStorage.getItem(
      "koyal-ai-subscription"
    );

    if (
      savedPlan === "Just" ||
      savedPlan === "Let It" ||
      savedPlan === "Care" ||
      savedPlan === "Elite" ||
      savedPlan === "Supreme"
    ) {
      setSubscriptionPlan(savedPlan);
    } else {
      setSubscriptionPlan("Just");
    }
  }

  function saveProfile() {
    if (!profile.name.trim()) {
      alert("Please enter your name.");
      return;
    }

    if (!profile.dob) {
      alert("Please enter your date of birth.");
      return;
    }

    if (!profile.gender) {
      alert("Please select your gender.");
      return;
    }

    if (!profile.phone.trim()) {
      alert("Please enter your phone number.");
      return;
    }

    localStorage.setItem(
      "koyal-ai-profile",
      JSON.stringify(profile)
    );

    // Also save name separately if other Koyal AI components use it
    localStorage.setItem(
      "koyal-ai-name",
      profile.name.trim()
    );

    window.dispatchEvent(
      new CustomEvent("koyal-profile-changed")
    );

    alert("Profile saved successfully.");
  }

  function signOutProfile() {
    const confirmSignOut = confirm(
      "Sign out from this profile?"
    );

    if (!confirmSignOut) return;

    localStorage.removeItem("koyal-ai-profile");
    localStorage.removeItem("koyal-ai-name");

    setProfile({
      name: "",
      dob: "",
      gender: "",
      phone: "",
    });

    onClose();

    window.dispatchEvent(
      new CustomEvent("koyal-profile-changed")
    );
  }

  function getPlanPrice() {
    const price = PLAN_PRICES[subscriptionPlan];

    if (price === 0) {
      return "Free";
    }

    return `₹${price} / month`;
  }

  if (!open) return null;

  return (
    <>
      {/* BACKGROUND */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.78)",
          backdropFilter: "blur(3px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 8000,
          padding: "20px",
        }}
      >
        {/* PROFILE CARD */}
        <div
          style={{
            width: "100%",
            maxWidth: "430px",
            maxHeight: "92vh",
            overflowY: "auto",

            background: "#181b23",
            border: "1px solid #343a48",

            borderRadius: "26px",

            padding: "28px",

            color: "white",

            position: "relative",

            boxShadow:
              "0 25px 70px rgba(0,0,0,0.55)",
          }}
        >
          {/* HEADER */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    fontSize: "27px",
                  }}
                >
                  👤
                </span>

                <h2
                  style={{
                    margin: 0,
                    fontSize: "25px",
                    fontWeight: 800,
                  }}
                >
                  Profile
                </h2>
              </div>

              <div
                style={{
                  fontSize: "13px",
                  color: "#8d93a3",
                  marginTop: "3px",
                }}
              >
                KOYAL AI V2.0
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                border: "none",
                background: "transparent",
                color: "white",
                fontSize: "27px",
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* AVATAR */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "26px",
              marginBottom: "22px",
            }}
          >
            <div
              style={{
                width: "90px",
                height: "90px",

                borderRadius: "50%",

                background: "#272a32",

                border: "1px solid #464b58",

                display: "flex",
                alignItems: "center",
                justifyContent: "center",

                fontSize: "35px",
              }}
            >
              👤
            </div>
          </div>

          {/* NAME */}
          <label style={labelStyle}>
            Name
          </label>

          <input
            type="text"
            value={profile.name}
            onChange={(e) =>
              setProfile({
                ...profile,
                name: e.target.value,
              })
            }
            placeholder="Enter your name"
            style={inputStyle}
          />

          {/* DOB */}
          <label style={labelStyle}>
            Date of Birth
          </label>

          <input
            type="date"
            value={profile.dob}
            onChange={(e) =>
              setProfile({
                ...profile,
                dob: e.target.value,
              })
            }
            style={inputStyle}
          />

          {/* GENDER */}
          <label style={labelStyle}>
            Gender
          </label>

          <select
            value={profile.gender}
            onChange={(e) =>
              setProfile({
                ...profile,
                gender: e.target.value,
              })
            }
            style={{
              ...inputStyle,
              cursor: "pointer",
            }}
          >
            <option value="">
              Select gender
            </option>

            <option value="Male">
              Male
            </option>

            <option value="Female">
              Female
            </option>

            <option value="Other">
              Other
            </option>

            <option value="Prefer not to say">
              Prefer not to say
            </option>
          </select>

          {/* PHONE */}
          <label style={labelStyle}>
            Phone Number
          </label>

          <input
            type="tel"
            value={profile.phone}
            onChange={(e) =>
              setProfile({
                ...profile,
                phone: e.target.value,
              })
            }
            placeholder="Enter phone number"
            style={inputStyle}
          />

          {/* CURRENT SUBSCRIPTION */}
          <div
            style={{
              marginTop: "22px",
              marginBottom: "18px",

              padding: "16px",

              borderRadius: "14px",

              border: "1px solid #343947",

              background: "#11141b",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "#9298a8",
                letterSpacing: "0.7px",
                marginBottom: "10px",
              }}
            >
              CURRENT PLAN
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 800,
                  }}
                >
                  {subscriptionPlan}
                </div>

                <div
                  style={{
                    color: "#9ca3af",
                    fontSize: "13px",
                    marginTop: "4px",
                  }}
                >
                  {getPlanPrice()}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSubscriptionOpen(true)
                }
                style={{
                  border: "1px solid #51586a",

                  background: "#252a35",

                  color: "white",

                  borderRadius: "10px",

                  padding: "9px 14px",

                  cursor: "pointer",

                  fontWeight: 700,

                  fontSize: "13px",
                }}
              >
                {subscriptionPlan === "Supreme"
                  ? "Manage Plan"
                  : "Upgrade"}
              </button>
            </div>

            {/* PLAN SPECIAL FEATURE */}
            <div
              style={{
                marginTop: "12px",
                paddingTop: "12px",
                borderTop: "1px solid #292d37",
                color: "#aeb4c0",
                fontSize: "12px",
                lineHeight: 1.6,
              }}
            >
              {subscriptionPlan === "Just" && (
                <>
                  Core Koyal AI access
                </>
              )}

              {subscriptionPlan === "Let It" && (
                <>
                  Precise Mode unlocked • Let It
                  costs 50% less
                </>
              )}

              {subscriptionPlan === "Care" && (
                <>
                  Let It + Care costs 50% less
                </>
              )}

              {subscriptionPlan === "Elite" && (
                <>
                  Code Mode unlocked • Let It,
                  Care, High, Ultra High and Elite
                  cost 50% less
                </>
              )}

              {subscriptionPlan === "Supreme" && (
                <>
                  Personal Mode • Supreme Thinking •
                  Infinite Feathers
                </>
              )}
            </div>
          </div>

          {/* SAVE PROFILE */}
          <button
            onClick={saveProfile}
            style={{
              width: "100%",

              padding: "14px",

              borderRadius: "12px",

              border: "none",

              background: "#f4f4f5",

              color: "#111",

              cursor: "pointer",

              fontSize: "14px",

              fontWeight: 800,

              marginBottom: "11px",
            }}
          >
            Save Profile
          </button>

          {/* SIGN OUT */}
          <button
            onClick={signOutProfile}
            style={{
              width: "100%",

              padding: "14px",

              borderRadius: "12px",

              border: "1px solid #973c49",

              background: "#351e25",

              color: "#ff727c",

              cursor: "pointer",

              fontSize: "14px",

              fontWeight: 800,
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* SUBSCRIPTION BUYING WINDOW */}
      <SubscriptionModal
        open={subscriptionOpen}
        onClose={() => {
          setSubscriptionOpen(false);

          // Refresh plan after closing subscription
          loadSubscription();
        }}
      />
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",

  marginTop: "15px",
  marginBottom: "7px",

  fontSize: "12px",

  fontWeight: 700,

  color: "#e2e4e9",
};

const inputStyle: React.CSSProperties = {
  width: "100%",

  boxSizing: "border-box",

  padding: "12px 14px",

  borderRadius: "11px",

  border: "1px solid #303642",

  background: "#10131a",

  color: "white",

  fontSize: "14px",

  outline: "none",
};