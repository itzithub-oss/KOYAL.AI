"use client";

import { useEffect, useState } from "react";

type PlanName = "Just" | "Let It" | "Care" | "Elite" | "Supreme";

type Props = {
  open: boolean;
  onClose: () => void;
};

const plans = [
  {
    name: "Just" as PlanName,
    price: 0,
    subtitle: "Start with Koyal AI",
    features: [
      "Unlimited file uploads",
      "Unlimited voice/audio",
      "Core Koyal AI access",
      "Image Generation - Coming Soon",
    ],
  },

  {
    name: "Let It" as PlanName,
    price: 70,
    subtitle: "More precise answers",
    features: [
      "Precise Mode",
      "Let It thinking costs 50% less",
      "Unlimited file uploads",
      "Unlimited voice/audio",
      "Image Generation - Coming Soon",
    ],
  },

  {
    name: "Care" as PlanName,
    price: 120,
    subtitle: "More intelligence and flexibility",
    features: [
      "Everything in Let It",
      "Let It costs 50% less",
      "Care costs 50% less",
      "Unlimited file uploads",
      "Unlimited voice/audio",
    ],
  },

  {
    name: "Elite" as PlanName,
    price: 220,
    subtitle: "Advanced intelligence and coding",
    features: [
      "Everything in Care",
      "Code Mode",
      "Let It costs 50% less",
      "Care costs 50% less",
      "High costs 50% less",
      "Ultra High costs 50% less",
      "Elite costs 50% less",
    ],
  },

  {
    name: "Supreme" as PlanName,
    price: 400,
    subtitle: "The complete Koyal AI experience",
    features: [
      "Everything in Elite",
      "Personal Mode",
      "Supreme Thinking",
      "Infinite Feathers",
      "Highly personalized answers",
      "Highest Koyal AI access",
    ],
  },
];

export default function SubscriptionModal({
  open,
  onClose,
}: Props) {
  const [activePlan, setActivePlan] = useState<PlanName>("Just");

  useEffect(() => {
    const savedPlan = localStorage.getItem("koyal-ai-subscription");

    if (
      savedPlan === "Just" ||
      savedPlan === "Let It" ||
      savedPlan === "Care" ||
      savedPlan === "Elite" ||
      savedPlan === "Supreme"
    ) {
      setActivePlan(savedPlan);
    }
  }, [open]);

  function choosePlan(plan: PlanName) {
    // TEMPORARY:
    // This activates the plan directly.
    // Later replace this with your payment success logic.

    localStorage.setItem("koyal-ai-subscription", plan);

    setActivePlan(plan);

    window.dispatchEvent(
      new CustomEvent("koyal-subscription-changed", {
        detail: plan,
      })
    );
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "95%",
          maxWidth: "1250px",
          maxHeight: "92vh",
          overflowY: "auto",

          background: "#202020",

          border: "1px solid #3a3a3a",

          borderRadius: "22px",

          color: "white",

          padding: "32px",

          position: "relative",
        }}
      >
        {/* CLOSE */}

        <button
          onClick={onClose}
          style={{
            position: "absolute",
            right: "22px",
            top: "18px",

            background: "transparent",

            border: "none",

            color: "#bbb",

            fontSize: "28px",

            cursor: "pointer",
          }}
        >
          ×
        </button>

        {/* TITLE */}

        <h1
          style={{
            textAlign: "center",
            fontSize: "36px",
            margin: "10px 0 8px",
          }}
        >
          Upgrade your plan
        </h1>

        <p
          style={{
            textAlign: "center",
            color: "#aaa",
            marginBottom: "32px",
          }}
        >
          Choose the Koyal AI plan that fits you best.
        </p>

        {/* PLANS */}

        <div
          style={{
            display: "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",

            gap: "18px",
          }}
        >
          {plans.map((plan) => {
            const current = activePlan === plan.name;

            return (
              <div
                key={plan.name}
                style={{
                  border: current
                    ? "1px solid #4d91ff"
                    : "1px solid #444",

                  borderRadius: "20px",

                  background:
                    plan.name === "Supreme"
                      ? "#24374b"
                      : "#232323",

                  padding: "24px",

                  display: "flex",

                  flexDirection: "column",

                  minHeight: "460px",
                }}
              >
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    marginBottom: "25px",
                  }}
                >
                  {plan.name}
                </div>

                <h2
                  style={{
                    fontSize: "25px",
                    marginBottom: "10px",
                  }}
                >
                  {plan.subtitle}
                </h2>

                <div
                  style={{
                    marginTop: "8px",

                    marginBottom: "20px",

                    fontSize: "34px",
                  }}
                >
                  {plan.price === 0 ? (
                    "Free"
                  ) : (
                    <>
                      ₹{plan.price}
                      <span
                        style={{
                          fontSize: "14px",
                          color: "#ccc",
                        }}
                      >
                        {" "}
                        / month
                      </span>
                    </>
                  )}
                </div>

                <button
                  onClick={() => choosePlan(plan.name)}
                  disabled={current}
                  style={{
                    width: "100%",

                    padding: "13px",

                    borderRadius: "30px",

                    border: current
                      ? "1px solid #444"
                      : "none",

                    background: current
                      ? "#242424"
                      : "#3b82f6",

                    color: current
                      ? "#777"
                      : "white",

                    cursor: current
                      ? "default"
                      : "pointer",

                    fontWeight: 700,

                    fontSize: "14px",

                    marginBottom: "22px",
                  }}
                >
                  {current
                    ? "Your current plan"
                    : plan.price === 0
                    ? "Choose Just"
                    : "✦ Upgrade"}
                </button>

                <div
                  style={{
                    display: "flex",

                    flexDirection: "column",

                    gap: "15px",

                    fontSize: "14px",
                  }}
                >
                  {plan.features.map((feature) => (
                    <div
                      key={feature}
                      style={{
                        display: "flex",
                        gap: "10px",
                      }}
                    >
                      <span
                        style={{
                          color: "#58a6ff",
                        }}
                      >
                        ✓
                      </span>

                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: "25px",

            textAlign: "center",

            color: "#888",

            fontSize: "12px",
          }}
        >
          Image Generation — Coming Soon
        </div>
      </div>
    </div>
  );
}