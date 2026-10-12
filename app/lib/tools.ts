export function getCurrentDateTime() {
  const now = new Date();

  return now.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "medium",
  });
}

export function calculate(expression: string) {
  try {
    // Allows only basic arithmetic
    if (!/^[0-9+\-*/().%\s]+$/.test(expression)) {
      return "Invalid calculation";
    }

    const result = Function(`"use strict"; return (${expression})`)();
    return String(result);
  } catch {
    return "Calculation error";
  }
}

export async function checkInternet() {
  try {
    const response = await fetch("https://www.google.com", {
      method: "HEAD",
      cache: "no-store",
    });

    return response.ok;
  } catch {
    return false;
  }
}