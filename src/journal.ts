import type { ReflectionStore, ReflectionStatus } from "./evening-reflection.ts";

export type JournalEntry = {
  date: string;
  intention: string;
  status: ReflectionStatus | "";
  note: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Read-only chronological projection; never scores or interprets the user's entries. */
export function journalEntries(
  birth: string,
  intentions: Record<string, string>,
  reflections: ReflectionStore,
): JournalEntry[] {
  if (!DATE.test(birth)) return [];
  const entries = new Map<string, JournalEntry>();
  for (const [date, intention] of Object.entries(intentions)) {
    if (!DATE.test(date) || !intention || date < birth) continue;
    entries.set(date, { date, intention, status: "", note: "" });
  }
  for (const [key, reflection] of Object.entries(reflections)) {
    const [entryBirth, date, extra] = key.split("|");
    if (entryBirth !== birth || extra !== undefined || !DATE.test(date) || date < birth) continue;
    if (!reflection.status && !reflection.note.trim()) continue;
    const previous = entries.get(date) ?? { date, intention: "", status: "" as const, note: "" };
    entries.set(date, { ...previous, status: reflection.status, note: reflection.note });
  }
  return [...entries.values()].sort((a, b) => b.date.localeCompare(a.date));
}
