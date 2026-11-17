/**
 * Immutable daily oracle snapshots and subjective retrospective ratings.
 * Kept independent of birth-date settings and journal reflection keys.
 */
export type ForecastRating = "yes" | "partial" | "no" | "unsure";
export type ForecastSnapshot = {
  date: string;
  birthDateAtCreation: string;
  persona: "mystic" | "skeptic";
  locale: "fi" | "en";
  message: string;
  createdAt: string;
  assessment?: {
    rating: ForecastRating;
    firstRatedAt: string;
    updatedAt: string;
    note: string;
  };
};
export type ForecastHistory = Record<string, ForecastSnapshot>;

const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  !Number.isNaN(Date.parse(date)) && new Date(date + "T12:00:00Z").toISOString().slice(0, 10) === date;

export function addForecast(history: ForecastHistory, forecast: ForecastSnapshot): ForecastHistory {
  if (!validDate(forecast.date) || !validDate(forecast.birthDateAtCreation) ||
      !forecast.message.trim() || !Number.isFinite(Date.parse(forecast.createdAt)) ||
      forecast.assessment) throw new Error("Invalid forecast");
  if (history[forecast.date]) return history; // Never silently rewrite a historical prediction.
  return { ...history, [forecast.date]: { ...forecast } };
}

export function mayAssess(forecastDate: string, now: Date): boolean {
  if (!validDate(forecastDate)) return false;
  // Local evening at 18:00; older dates remain assessable.
  const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")].join("-");
  return forecastDate < today || (forecastDate === today && now.getHours() >= 18);
}

export function assessForecast(
  history: ForecastHistory, date: string, rating: ForecastRating, note: string, now: Date
): ForecastHistory {
  const forecast = history[date];
  if (!forecast || !mayAssess(date, now) ||
      !["yes", "partial", "no", "unsure"].includes(rating) || note.length > 500)
    throw new Error("Assessment not allowed");
  const timestamp = now.toISOString();
  return { ...history, [date]: {
    ...forecast,
    assessment: { rating, note, firstRatedAt: forecast.assessment?.firstRatedAt ?? timestamp,
      updatedAt: timestamp }
  }};
}

export function forecastStats(history: ForecastHistory) {
  const ratings = Object.values(history).flatMap(f => f.assessment ? [f.assessment.rating] : []);
  return {
    rated: ratings.length,
    yes: ratings.filter(r => r === "yes").length,
    partial: ratings.filter(r => r === "partial").length,
    no: ratings.filter(r => r === "no").length,
    unsure: ratings.filter(r => r === "unsure").length,
  };
}
