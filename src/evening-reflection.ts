export type ReflectionStatus = "done" | "partly" | "not-today";
export type DailyReflection = { status: ReflectionStatus | ""; note: string };
export type ReflectionStore = Record<string, DailyReflection>;
export const REFLECTION_STORAGE_KEY = "dayoracle-reflections";
export const EMPTY_REFLECTION: DailyReflection = { status: "", note: "" };

export function reflectionKey(birth: string, day: string): string {
  return `${birth}|${day}`;
}

export function parseReflections(raw: string | null): ReflectionStore {
  if (!raw) return {};
  try {
    const input: unknown = JSON.parse(raw);
    if (!input || typeof input !== "object" || Array.isArray(input)) return {};
    const result: ReflectionStore = {};
    for (const [key, value] of Object.entries(input)) {
      if (!/^\\d{4}-\\d{2}-\\d{2}\\|\\d{4}-\\d{2}-\\d{2}$/.test(key)) continue;
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const candidate = value as Record<string, unknown>;
      const status = candidate.status;
      if (status !== "" && status !== "done" && status !== "partly" && status !== "not-today") continue;
      if (typeof candidate.note !== "string") continue;
      result[key] = { status, note: candidate.note.slice(0, 500) };
    }
    return result;
  } catch {
    return {};
  }
}

export function updateReflection(
  store: ReflectionStore,
  key: string,
  update: Partial<DailyReflection>,
): ReflectionStore {
  const previous = store[key] ?? EMPTY_REFLECTION;
  const next = { ...previous, ...update };
  return { ...store, [key]: { status: next.status, note: next.note.slice(0, 500) } };
}

export function clearBirthReflections(store: ReflectionStore, birth: string): ReflectionStore {
  return Object.fromEntries(Object.entries(store).filter(([key]) => !key.startsWith(`${birth}|`)));
}
