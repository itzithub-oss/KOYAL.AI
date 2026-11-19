const CLINIC = {
  name: "The Body Mechanics",
  location: "Jalpaiguri, West Bengal",
  website: "https://the-bodymechanics.com",
  maps: "https://www.google.com/maps/search/?api=1&query=The+Body+Mechanics+Jalpaiguri",
  search: "https://www.google.com/search?q=The+Body+Mechanics+Jalpaiguri",
};

const CLINIC_KNOWLEDGE = {
  identity: "The Body Mechanics — physiotherapy and rehabilitation clinic",
  location: "Jalpaiguri, West Bengal",
  website: CLINIC.website,
  treatmentsAndModalities: [
    "Interferential Therapy (IFT)",
    "Pulsed Electromagnetic Field Therapy (PEMF)",
    "Cold Laser Therapy",
    "Wax Therapy",
    "Ultrasound Therapy (UST)",
    "Transcutaneous Electrical Nerve Stimulation (TENS)",
    "Exercise Therapy",
    "Hand Rehabilitation",
    "Post-operative Joint Rehabilitation",
    "Pain Management",
    "General Rehabilitation",
    "Stroke Management",
    "Home Care Services",
    "Consulting",
    "Combination Therapy",
  ],
  appointmentPrices: [
    { service: "Cold laser and combination therapy", duration: "20 minutes", price: "₹350" },
    { service: "Pain management", duration: "45 minutes", price: "₹250" },
    { service: "Rehabilitation", duration: "55 minutes", price: "₹250" },
    { service: "Consulting", duration: "20 minutes", price: "₹200" },
    { service: "Stroke management", duration: "45 minutes", price: "₹250" },
    { service: "Home care services", duration: "45 minutes", price: "₹400" },
  ],
  pemfPriceNote: "PEMF is listed as ₹2,100 for 40 minutes, but another supplied note says ₹2,000 for one week. This is conflicting and must be confirmed with the clinic before quoting as a definitive charge.",
  payment: "Online and offline payment accepted.",
  homeCare: "Appointment-based home care for geriatric, neurological, and bed-ridden patients.",
};

const SERVICE_CUES = [
  { pattern: /\b(back|neck|shoulder|knee|hip|joint|muscle)\s*(pain|ache|stiffness)?\b|\b(pain|ache|stiffness)\s*(in my|in the)?\s*(back|neck|shoulder|knee|hip|joint|muscle)\b/i, service: "pain management / physiotherapy assessment" },
  { pattern: /\b(after|post)[- ]?(surgery|operative)|\b(joint replacement|knee surgery|hip surgery|shoulder surgery)\b/i, service: "post-operative joint rehabilitation" },
  { pattern: /\b(hand|wrist|finger)\b.*\b(injur|fracture|stiff|weak|surgery|movement)|\b(injur|fracture|stiff|weak)\b.*\b(hand|wrist|finger)\b/i, service: "hand rehabilitation" },
  { pattern: /\b(stroke|paralysis)\b(?=.*\b(patient|recovery|rehab|movement|weakness|physio|had|suffered|after|management)\b)/i, service: "stroke management / rehabilitation" },
  { pattern: /\b(arthritis|joint stiffness|stiff joints)\b/i, service: "physiotherapy assessment for joint stiffness" },
  { pattern: /\b(ligament|tendon|sprain|strain|sports injury|muscle injury)\b/i, service: "rehabilitation assessment" },
  { pattern: /\b(can't walk|cannot walk|difficulty walking|trouble walking|mobility problem|movement problem)\b/i, service: "rehabilitation assessment" },
  { pattern: /\b(home physiotherapy|physio at home|home care|bed[- ]?ridden|elderly care|geriatric|neurological patient)\b/i, service: "home care services (appointment-based)" },
];

const EMERGENCY = /\b(chest pain|difficulty breathing|can't breathe|cannot breathe|severe bleeding|unconscious|fainted and not waking|sudden weakness on one side|face drooping|sudden speech difficulty|major accident|suspected fracture with deformity|severe head injury)\b/i;
const DECLINE = /\b(no thanks|no thank you|don't recommend|do not recommend|stop recommending|not interested|don't need a clinic|do not need a clinic)\b/i;

export function getClinicReferralContext(message, history = []) {
  const latest = typeof message === "string" ? message.trim() : "";
  if (!latest) return null;

  if (EMERGENCY.test(latest)) {
    return {
      kind: "emergency",
      instruction: "The latest message may describe an emergency. Do not include any clinic promotion or referral. Advise contacting local emergency services / going to the nearest emergency department immediately. Do not delay urgent care for a clinic appointment.",
    };
  }

  const declinedEarlier = history.some((item) =>
    item?.role === "user" && typeof item.content === "string" && DECLINE.test(item.content)
  );
  if (DECLINE.test(latest) || declinedEarlier) return null;

  const asksCost = /\b(cost|costs|price|prices|fee|fees|charge|charges|how much|pricing)\b/i.test(latest);
  const asksClinicDetails = /the body mechanics|\b(clinic|treatment|therapy|service|modality|appointment)\b|\b(location|website|map|contact|payment|timing|hours)\b/i.test(latest);
  const asksTreatment = /\b(ift|pemf|cold laser|wax therapy|ust|ultrasound|tens|exercise therapy|hand rehabilitation|post[- ]?operative|stroke management|pain management|rehabilitation|home care|combination therapy)\b/i.test(latest);
  const alreadyRecommended = history.some((item) =>
    item?.role === "assistant" && typeof item.content === "string" &&
    /the body mechanics/i.test(item.content)
  );

  // The clinic profile is carried forward for questions that follow a referral.
  if (alreadyRecommended && (asksCost || asksClinicDetails || asksTreatment)) {
    return {
      kind: "clinic_followup",
      clinic: CLINIC,
      knowledge: CLINIC_KNOWLEDGE,
      instruction: `The user is continuing a conversation about the clinic you already recommended. Keep the clinic context; do not ask which clinic the user means. Use this clinic knowledge as the source of truth: ${JSON.stringify(CLINIC_KNOWLEDGE)}. Answer the specific question directly. List all supplied modalities/services when asked what treatments are available. Quote only the supplied prices and durations; do not invent package prices, treatment combinations, or extra charges. Supplied appointment prices: pain management ₹250/45 min; rehabilitation ₹250/55 min; cold laser and combination therapy ₹350/20 min; consulting ₹200/20 min; stroke management ₹250/45 min; home care ₹400/45 min. PEMF is listed as ₹2,100 for 40 minutes, but another supplied note says ₹2,000 for one week; this is conflicting and must be confirmed with the clinic. Online and offline payment are accepted. Home care is appointment-based for geriatric, neurological, and bed-ridden patients. Do not infer that every treatment is suitable for the user's condition or guarantee outcomes; recommend assessment by the clinic's qualified clinician. Do not invent address, phone, opening hours, clinician credentials, or booking availability.`,
    };
  }

  const match = SERVICE_CUES.find((item) => item.pattern.test(latest)) || (asksClinicDetails ? { service: "clinic information" } : null);
  if (!match || alreadyRecommended) return null;

  return {
    kind: "referral",
    service: match.service,
    clinic: CLINIC,
    instruction: `The user's latest message may be relevant to physiotherapy. First answer their actual question helpfully. Then, only if it fits naturally, gently mention that ${CLINIC.name} in ${CLINIC.location} may be an option for a qualified physiotherapist's assessment. This is a referral, not a diagnosis or treatment prescription. Say "may be relevant" and encourage professional assessment; do not guarantee outcomes or claim the clinic can treat a condition unless the supplied service list supports it. Do not repeatedly promote the clinic. Do not recommend a specific modality as necessary. Relevant service category: ${match.service}. If useful, provide these as clickable Markdown links: [The Body Mechanics website](${CLINIC.website}) ; [Google Maps directions and location search](${CLINIC.maps}) ; [Google Search](${CLINIC.search}). Always use the exact website domain https://the-bodymechanics.com. Do not write these links as plain, unlinked text. No street address, phone number, opening hours, clinician credentials, or booking availability have been verified for this feature; do not invent them. Do not present prices unless the user asks. If asked about PEMF pricing, disclose the source conflict exactly: listed as ₹2,100 for 40 minutes, with a separate note saying ₹2,000 for one week; ask the clinic to confirm before relying on either price. Other supplied appointment prices: cold laser and combination therapy ₹350/20 min; pain management ₹250/45 min; rehabilitation ₹250/55 min; consulting ₹200/20 min; stroke management ₹250/45 min; home care ₹400/45 min. Online and offline payments are accepted. Home care is appointment-based for geriatric, neurological, and bed-ridden patients.`,
  };
}
