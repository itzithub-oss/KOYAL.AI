const CATEGORY_TERMS = [
  { category: "Healthcare", words: ["healthcare","health","clinic","physiotherapy","physiotherapist","physio","doctor","medical","rehabilitation","dentist","hospital","therapy"] },
  { category: "Education", words: ["education","tutor","tuition","teacher","coaching","school","mathematics","maths","math","science","english","exam"] },
  { category: "Computer & Electronics", words: ["computer","laptop","repair","electronics","mobile","phone","printer","software","hardware","it service"] },
  { category: "Food & Dining", words: ["restaurant","food","cafe","café","bakery","catering","delivery","meal"] },
  { category: "Home & Local Services", words: ["plumber","electrician","cleaning","carpenter","home service","repair service"] },
  { category: "Automotive", words: ["car","bike","vehicle","garage","mechanic","automotive"] },
  { category: "Beauty & Wellness", words: ["salon","beauty","spa","barber","makeup"] },
];

const SYNONYMS = new Map([
  ["physio", ["physiotherapy","physiotherapist","physical therapy"]],
  ["physiotherapist", ["physiotherapy","physio","physical therapist"]],
  ["physiotherapy", ["physio","physical therapy","rehabilitation"]],
  ["math", ["mathematics","maths"]],
  ["maths", ["mathematics","math"]],
  ["tutor", ["teacher","tuition","coaching"]],
  ["laptop", ["computer","notebook"]],
  ["repair", ["service","fix","maintenance"]],
  ["food", ["restaurant","dining","meal"]],
  ["restaurant", ["food","dining","home delivery"]],
  ["backache", ["back pain","pain management"]],
  ["sports injury", ["sports physiotherapy","injury rehabilitation"]],
]);

const STOP_WORDS = new Set(["i","need","want","find","a","an","the","for","in","near","around","at","with","please","me","my","to","of","and","or","is","are","looking","search","business","service","services","best"]);

export function normaliseFindUpQuery(value) {
  return String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9₹.\s-]/g, " ").replace(/\s+/g, " ").trim();
}

export function inferFindUpQuery(value) {
  const query = normaliseFindUpQuery(value);
  const category = CATEGORY_TERMS.find((item) => item.words.some((word) => query.includes(word)))?.category || "";
  const locationMatch = query.match(/\b(?:in|near|around|at)\s+([a-z][a-z .'-]{1,48}?)(?=\s+(?:for|with|under|below|within)\b|$)/i);
  const budgetMatch = query.match(/(?:under|below|within|budget(?: of)?|less than)\s*₹?\s*(\d[\d,]*(?:\.\d+)?)/i);
  const expanded = new Set(query.split(" ").filter((word) => word.length > 1 && !STOP_WORDS.has(word)));
  for (const [word, alternatives] of SYNONYMS) {
    if (query.includes(word)) alternatives.forEach((item) => expanded.add(item));
  }
  return {
    category,
    location: locationMatch ? locationMatch[1].trim().replace(/[. ]+$/, "") : "",
    budget: budgetMatch ? Number(budgetMatch[1].replace(/,/g, "")) : null,
    terms: [...expanded],
  };
}

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

function searchableText(business) {
  const services = Array.isArray(business.services) ? business.services : [];
  const serviceText = services.flatMap((service) => typeof service === "string" ? [service] : [service?.name, service?.description, ...(service?.keywords || [])]).filter(Boolean);
  return normaliseFindUpQuery([
    business.display_name, business.business_name, business.category, business.subcategory,
    business.description, ...(business.keywords || []), ...(business.specialisations || []),
    ...(business.search_synonyms || []), ...serviceText,
  ].join(" "));
}

function locationText(business) {
  const location = business.location || {};
  return normaliseFindUpQuery([location.full_address, location.address, location.city, location.district, location.state, location.pin_code, ...(location.service_areas || [])].filter(Boolean).join(" "));
}

function startingPrice(business) {
  const pricing = business.pricing || {};
  const candidates = [pricing.starting_price, pricing.consultation_fee, business.starting_price]
    .map((value) => Number(String(value ?? "").replace(/[^0-9.]/g, "")))
    .filter((value) => Number.isFinite(value) && value >= 0);
  return candidates.length ? Math.min(...candidates) : null;
}

function tokenMatches(term, text) {
  if (text.includes(term)) return true;
  const words = text.split(" ");
  return words.some((word) => word.length >= 4 && editDistance(term, word) <= (term.length >= 7 ? 2 : 1));
}

export function rankFindUpBusinesses(businesses, rawQuery, filters = {}) {
  const parsed = inferFindUpQuery(rawQuery);
  const requestedLocation = normaliseFindUpQuery(filters.location || parsed.location);
  const requestedCategory = normaliseFindUpQuery(filters.category || parsed.category);
  const budget = filters.maxPrice !== "" && filters.maxPrice != null ? Number(filters.maxPrice) : parsed.budget;
  const results = [];

  for (const business of businesses || []) {
    if (business.status !== "APPROVED") continue;
    const text = searchableText(business);
    const place = locationText(business);
    const category = normaliseFindUpQuery([business.category, business.subcategory].join(" "));
    const terms = parsed.terms;
    let serviceScore = 0;
    const matchedTerms = [];
    for (const term of terms) {
      if (tokenMatches(term, text)) {
        serviceScore += 3;
        matchedTerms.push(term);
      }
    }
    const categoryMatch = !requestedCategory || category.includes(requestedCategory) || text.includes(requestedCategory);
    const locationMatch = !requestedLocation || place.includes(requestedLocation);
    if (requestedCategory && categoryMatch) serviceScore += 7;
    if (requestedLocation && locationMatch) serviceScore += 6;
    if (budget != null && Number.isFinite(budget)) {
      const price = startingPrice(business);
      if (price != null && price <= budget) serviceScore += 2;
      else if (price != null && price > budget) serviceScore -= 2;
    }
    if (filters.category && !categoryMatch) continue;
    if (filters.location && !locationMatch) continue;
    if (filters.maxPrice !== "" && filters.maxPrice != null) {
      const price = startingPrice(business);
      if (price != null && price > Number(filters.maxPrice)) continue;
    }
    if (terms.length && matchedTerms.length === 0 && !categoryMatch) continue;
    if (!terms.length && !requestedCategory && !requestedLocation) continue;
    const services = Array.isArray(business.services) ? business.services : [];
    const reasonParts = [];
    if (matchedTerms.length) reasonParts.push("offers services matching " + matchedTerms.slice(0, 3).join(", "));
    if (requestedCategory && categoryMatch) reasonParts.push("is listed under " + (business.category || requestedCategory));
    if (requestedLocation && locationMatch) reasonParts.push("is located in the requested area");
    results.push({
      ...business,
      _score: serviceScore,
      _matchReason: reasonParts.length ? "Matches your search because it " + reasonParts.join(" and ") + "." : "Matches the selected category or location.",
      _matchedTerms: matchedTerms,
      _startingPrice: startingPrice(business),
    });
  }
  return results.sort((a, b) => b._score - a._score || String(a.display_name || a.business_name).localeCompare(String(b.display_name || b.business_name)));
}

export function validateFindUpApplication(input) {
  const business = input && typeof input === "object" ? input : {};
  const errors = [];
  const required = (value) => typeof value === "string" && value.trim().length > 0;
  if (!required(business.business_name)) errors.push("Business name is required.");
  if (!required(business.category)) errors.push("Business category is required.");
  if (!required(business.description) || business.description.trim().length < 20) errors.push("Please provide a business description of at least 20 characters.");
  if (!required(business.owner_name)) errors.push("Owner name is required.");
  if (!required(business.owner_phone)) errors.push("Owner phone number is required.");
  if (!required(business.city)) errors.push("City is required.");
  if (!required(business.state)) errors.push("State is required.");
  if (!Array.isArray(business.services) || !business.services.length) errors.push("Add at least one service.");
  return errors;
}
