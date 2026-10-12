"use client";

import { useEffect, useState } from "react";

type PlanName = "Just" | "Let It" | "Care" | "Elite" | "Supreme";

const planDetails: Record<
  PlanName,
  {
    price: number;
    benefits: string[];
  }
> = {
  Just: {
    price: 0,
    benefits: [
      "Unlimited Files",
      "Unlimited Voice/Audio",
      "Image Generation - Coming Soon",
    ],
  },

  "Let It": {
    price: 70,
    benefits: [
      "Precise Mode",
      "Let It costs 50% less",
      "Unlimited Files",
      "Unlimited Voice/Audio",
      "Image Generation - Coming Soon",
    ],
  },

  Care: {
    price: 120,
    benefits: [
      "Precise Mode",
      "Let It costs 50% less",
      "Care costs 50% less",
      "Unlimited Files",
      "Unlimited Voice/Audio",
      "Image Generation - Coming Soon",
    ],
  },

  Elite: {
    price: 220,
    benefits: [
      "Precise Mode",
      "Code Mode",
      "Let It costs 50% less",
      "Care costs 50% less",
      "High costs 50% less",
      "Ultra High costs 50% less",
      "Elite costs 50% less",
      "Unlimited Files",
      "Unlimited Voice/Audio",
      "Image Generation - Coming Soon",
    ],
  },

  Supreme: {
    price: 400,
    benefits: [
      "Precise Mode",
      "Code Mode",
      "Personal Mode",
      "Infinite Feathers",
      "Supreme Thinking",
      "50% discount on eligible lower thinking modes",
      "Unlimited Files",
      "Unlimited Voice/Audio",
      "Image Generation - Coming Soon",
    ],
  },
};

export default function ProfilePage() {
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
  }, []);

  const currentPlan = planDetails[activePlan];

  return (
    <div
      style={{
        maxWidth: "700px",
        margin: "40px auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Profile</h1>

      <div
        style={{
          marginTop: "25px",
          padding: "24px",
          border: "1px solid #ddd",
          borderRadius: "18px",
        }}
      >
        <h2>{activePlan} Plan</h2>

        <p>
          <strong>Current Subscription:</strong> {activePlan}
        </p>

        <p>
          <strong>Price:</strong>{" "}
          {currentPlan.price === 0
            ? "Free"
            : `₹${currentPlan.price}/month`}
        </p>

        <p>
          <strong>Status:</strong> Active
        </p>

        <h3>Plan Benefits</h3>

        <ul>
          {currentPlan.benefits.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}