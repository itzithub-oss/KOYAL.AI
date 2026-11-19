export const findUpBusinesses = [
  {
    id: "the-body-mechanics",
    name: "The Body Mechanics",
    category: "Physiotherapy & Rehabilitation",
    description: "Physiotherapy and rehabilitation services, including home-care visits in Jalpaiguri town.",
    location: "Jalpaiguri town, West Bengal, India",
    website: "https://the-bodymechanics.com",
    professionalName: "Dr Prahelika Acharjee",
    qualifications: ["BPT", "MPT (Musculoskeletal & Sports)"],
    experience: "17+ years",
    services: ["Physiotherapy", "Musculoskeletal care", "Sports physiotherapy", "Home care"],
    serviceHours: "3:30 pm–7:00 pm",
  },
];

const STOP_WORDS = new Set(["a","an","the","i","need","want","looking","for","find","me","please","near","in","at","to","with","of","my","some","any","service","services","business","clinic"]);
const normalize = (value) => value.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function searchFindUpBusinesses(businesses, query) {
  const terms = normalize(query).split(/\s+/).filter((term) => term && !STOP_WORDS.has(term));
  if (!terms.length) return [];
  return businesses.map((business) => {
    const searchable = normalize([business.name,business.category,business.description,business.location,business.professionalName,...(business.qualifications || []),...(business.services || [])].filter(Boolean).join(" "));
    const words = new Set(searchable.split(/\s+/));
    const matched = terms.filter((term) => words.has(term) || [...words].some((word) => word.length > 4 && (word.startsWith(term) || term.startsWith(word))));
    const score = matched.length / terms.length;
    return { business, score, matched: matched.length };
  }).filter((item) => item.matched > 0 && (item.score >= 0.34 || item.matched >= 2))
    .sort((a,b) => b.score-a.score || b.matched-a.matched)
    .map(({business}) => business);
}
