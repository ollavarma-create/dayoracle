import type { ForecastHistory } from "./forecast-history.ts";
import { parseReflections, type ReflectionStore } from "./evening-reflection.ts";
import { journalEntries, type JournalEntry } from "./journal.ts";
export type JournalBackup = { format: "dayoracle-journal"; version: 2; birthDate: string; intentions: Record<string,string>; reflections: ReflectionStore; forecasts: ForecastHistory };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const INTENTIONS = new Set(["curious","kind","pause"]);
function validDate(s:string):boolean {
  if(!DATE.test(s)) return false;
  const [y,m,d]=s.split("-").map(Number);
  const parsed=new Date(Date.UTC(y,m-1,d));
  return parsed.getUTCFullYear()===y && parsed.getUTCMonth()===m-1 && parsed.getUTCDate()===d;
}
export function makeBackup(birthDate:string, intentions:Record<string,string>, reflections:ReflectionStore, forecasts:ForecastHistory = {}):JournalBackup {
  if(birthDate!==""&&!validDate(birthDate)) throw new Error("Invalid birth date");
  const safeIntentions:Record<string,string>={};
  for(const [date,value] of Object.entries(intentions)) if(validDate(date)&&INTENTIONS.has(value)) safeIntentions[date]=value;
  const safeReflections=parseReflections(JSON.stringify(reflections));
  return {format:"dayoracle-journal",version:2,birthDate,intentions:safeIntentions,
    reflections:safeReflections, forecasts: validateForecasts(forecasts)};
}
export function parseBackup(raw:string):JournalBackup {
  if(raw.length>2_000_000) throw new Error("Backup too large");
  let parsed:unknown;
  try {parsed=JSON.parse(raw);} catch {throw new Error("Invalid JSON");}
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)) throw new Error("Invalid backup");
  const data=parsed as Record<string,unknown>;
  if(data.format!=="dayoracle-journal"||(data.version!==1&&data.version!==2)||typeof data.birthDate!=="string"||(data.birthDate!==""&&!validDate(data.birthDate))) throw new Error("Invalid backup header");
  if(!data.intentions||typeof data.intentions!=="object"||Array.isArray(data.intentions)||!data.reflections||typeof data.reflections!=="object"||Array.isArray(data.reflections)) throw new Error("Invalid backup entries");
  for(const [date,value] of Object.entries(data.intentions)) if(!validDate(date)||typeof value!=="string"||!INTENTIONS.has(value)) throw new Error("Invalid intention");
  for(const [key,value] of Object.entries(data.reflections)) {
    const [birth,date,extra]=key.split("|");
    if(!validDate(birth)||extra!==undefined||!validDate(date)||!value||typeof value!=="object"||Array.isArray(value)) throw new Error("Invalid reflection");
    const r=value as Record<string,unknown>;
    if(!["","done","partly","not-today"].includes(String(r.status))||typeof r.note!=="string"||r.note.length>500) throw new Error("Invalid reflection content");
  }
  const reflections=parseReflections(JSON.stringify(data.reflections));
  if(Object.keys(reflections).length!==Object.keys(data.reflections).length) throw new Error("Invalid reflection entries");
  return makeBackup(data.birthDate,data.intentions as Record<string,string>,reflections, data.version===2 ? validateForecasts(data.forecasts) : {});
}
const RATINGS = new Set(["yes", "partial", "no", "unsure"]);
function validateForecasts(input: unknown): ForecastHistory {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid forecasts");
  const result: ForecastHistory = {};
  for (const [key, value] of Object.entries(input)) {
    if (!validDate(key) || !value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid forecast entry");
    const f = value as Record<string, unknown>;
    if (f.date !== key || typeof f.birthDateAtCreation !== "string" || !validDate(f.birthDateAtCreation) ||
      !["mystic", "skeptic"].includes(String(f.persona)) || !["fi", "en"].includes(String(f.locale)) ||
      typeof f.message !== "string" || !f.message.trim() || f.message.length > 5000 ||
      typeof f.createdAt !== "string" || !Number.isFinite(Date.parse(f.createdAt))) throw new Error("Invalid forecast content");
    if (f.assessment !== undefined) {
      const a = f.assessment;
      if (!a || typeof a !== "object" || Array.isArray(a)) throw new Error("Invalid forecast assessment");
      const v = a as Record<string, unknown>;
      if (!RATINGS.has(String(v.rating)) || typeof v.note !== "string" || v.note.length > 500 ||
        typeof v.firstRatedAt !== "string" || !Number.isFinite(Date.parse(v.firstRatedAt)) ||
        typeof v.updatedAt !== "string" || !Number.isFinite(Date.parse(v.updatedAt)))
        throw new Error("Invalid forecast assessment");
    }
    result[key] = f as ForecastHistory[string];
  }
  return result;
}
export function filterJournal(entries:JournalEntry[],query:string):JournalEntry[] {
  const needle=query.trim().toLocaleLowerCase();
  return needle?entries.filter(e=>[e.date,e.intention,e.status,e.note].some(v=>v.toLocaleLowerCase().includes(needle))):entries;
}
export function backupMarkdown(backup:JournalBackup,labels:{title:string;intention:string;status:string;note:string}):string {
  const escape=(s:string)=>s.replace(/\r/g,"").replace(/([\\*_\[\]#>])/g,"\\$1");
  const rows=journalEntries(backup.birthDate,backup.intentions,backup.reflections);
  return ["# "+labels.title,"",...rows.flatMap(r=>["## "+r.date,"",
    ...(r.intention?["**"+labels.intention+":** "+escape(r.intention),""]:[]),
    ...(r.status?["**"+labels.status+":** "+escape(r.status),""]:[]),
    ...(r.note?["**"+labels.note+":** "+escape(r.note),""]:[])])].join("\n");
}
