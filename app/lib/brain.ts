import {
  getCurrentDateTime,
  calculate,
  checkInternet,
} from "./tools";

export async function runBrain(message: string) {
  const lower = message.toLowerCase();

  // DATE / TIME
  if (
    lower.includes("time") ||
    lower.includes("date") ||
    lower.includes("today")
  ) {
    return {
      handled: true,
      response: `Current date and time is ${getCurrentDateTime()}`,
    };
  }

  // CALCULATOR
  const mathMatch = message.match(/[0-9+\-*/().%\s]{3,}/);

  if (
    lower.includes("calculate") ||
    lower.includes("solve") ||
    mathMatch
  ) {
    const expression = mathMatch?.[0]?.trim();

    if (expression) {
      return {
        handled: true,
        response: calculate(expression),
      };
    }
  }

  // INTERNET STATUS
  if (
    lower.includes("internet") ||
    lower.includes("online") ||
    lower.includes("offline")
  ) {
    const online = await checkInternet();

    return {
      handled: true,
      response: online
        ? "Internet connection is available."
        : "Internet is currently unavailable.",
    };
  }

  return {
    handled: false,
    response: "",
  };
}