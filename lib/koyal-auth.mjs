export function validateKoyalCredentials({ email, password, phone = "", mode }) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim())) return "Enter a valid email address.";
  if (mode !== "reset" && String(password || "").length < 6) return "Password must be at least 6 characters.";
  if (mode === "signup" && phone.trim() && phone.replace(/\D/g, "").length < 7) return "Enter a valid phone number or leave it blank.";
  return "";
}
