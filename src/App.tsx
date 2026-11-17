import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import { dailyQuestion } from "./reflection";
import { journalEntries } from "./journal";
import { backupMarkdown, filterJournal, makeBackup, parseBackup } from "./journal-backup";
import { clearBirthReflections, EMPTY_REFLECTION, parseReflections, reflectionKey, REFLECTION_STORAGE_KEY, updateReflection, type DailyReflection } from "./evening-reflection";


type Cycles = { physical: number; emotional: number; intellectual: number };
type Point = { date: string; values: Cycles };
type Result = { date: string; daysLived: number; values: Cycles; timeline: Point[] };
type Locale = "en" | "fi";
type Persona = "mystic" | "skeptic";

const text = {
  en: {
    tagline: "A little wonder. A little wisdom. Absolutely no scientific prophecy.",
    birth: "Date of birth",
    date: "Oracle date",
    perspective: "Today's perspective",
    physical: "Physical", emotional: "Emotional", intellectual: "Intellectual",
    quote: "A thought for today",
    question: "A question worth asking",
    intentionSaved: "Saved on this device for this date",
    backToToday: "Today",
    evening: "Looking back",
    eveningPrompt: "What did you notice about your intention?",
    eveningDone: "I followed it",
    eveningPartly: "A little",
    eveningNotToday: "Not today",
    eveningNote: "One observation (optional)",
    eveningPlaceholder: "A small detail worth remembering…",
    eveningSaved: "Saved privately on this device",
    eveningClear: "Clear this reflection",
    timeline: "Your cosmic curves",
    showBiorhythms: "Daily biorhythms",
    backToOracle: "Back to oracle",
    journal: "Journal",
    journalTitle: "Your days, in your own words",
    journalSearch: "Search journal",
    journalSearchPlaceholder: "Search dates, intentions or notes…",
    journalExportJson: "Export JSON backup",
    journalExportMd: "Export Markdown",
    journalImport: "Restore JSON backup",
    journalImportConfirm: "Replace the current journal and birth date with this backup? This cannot be undone.",
    journalImportOk: "Backup restored",
    journalImportError: "Backup could not be restored",
    journalBackupNote: "Exports are unencrypted. Store them privately.",
    journalNoMatches: "No matching entries.",
    journalEmpty: "No saved intentions or reflections yet.",
    journalOpen: "Open this day",
    journalIntention: "Intention",
    journalObservation: "Observation",
    journalDone: "Followed it",
    journalPartly: "A little",
    journalNotToday: "Not today",
    mystic: "Mystic", skeptic: "Skeptic",
    noBirth: "Enter your date of birth to begin.",
    chartHint: "Hover to inspect · click a date to explore",
    disclaimer: "Classic biorhythms and astrology are for entertainment, not medical advice or reliable predictions.",
    days: "Days since birth",
    forget: "Forget birth date",
    intention: "An intention for today",
    curious: "Stay curious about one small thing.",
    kind: "Make a little room for kindness.",
    pause: "Take one moment without rushing.",
  },
  fi: {
    tagline: "Hieman ihmetystä. Hieman viisautta. Ei tieteellisiä ennustuksia.",
    birth: "Syntymäpäivä",
    date: "Oraakkelin päivä",
    perspective: "Päivän näkökulma",
    physical: "Fyysinen", emotional: "Emotionaalinen", intellectual: "Älyllinen",
    quote: "Päivän ajatus",
    question: "Kysymys pohdittavaksi",
    intentionSaved: "Tallennettu tälle päivälle tällä laitteella",
    backToToday: "Tänään",
    evening: "Päivän jälkiviisaus",
    eveningPrompt: "Mitä huomasit päivän aikomuksestasi?",
    eveningDone: "Toteutin sen",
    eveningPartly: "Vähän",
    eveningNotToday: "En tänään",
    eveningNote: "Yksi havainto (vapaaehtoinen)",
    eveningPlaceholder: "Pieni asia, jonka haluat muistaa…",
    eveningSaved: "Tallennettu yksityisesti tälle laitteelle",
    eveningClear: "Tyhjennä tämä pohdinta",
    timeline: "Kosmiset käyräsi",
    showBiorhythms: "Päivän biorytmit",
    backToOracle: "Takaisin oraakkeliin",
    journal: "Päiväkirja",
    journalTitle: "Omat päiväsi, omin sanoin",
    journalSearch: "Hae päiväkirjasta",
    journalSearchPlaceholder: "Hae päivämääriä, aikomuksia tai havaintoja…",
    journalExportJson: "Vie JSON-varmuuskopio",
    journalExportMd: "Vie Markdown",
    journalImport: "Palauta JSON-varmuuskopio",
    journalImportConfirm: "Korvataanko nykyinen päiväkirja ja syntymäpäivä varmuuskopiolla? Tätä ei voi perua.",
    journalImportOk: "Varmuuskopio palautettu",
    journalImportError: "Varmuuskopion palautus epäonnistui",
    journalBackupNote: "Vientitiedostot ovat salaamattomia. Säilytä ne yksityisesti.",
    journalNoMatches: "Ei hakua vastaavia merkintöjä.",
    journalEmpty: "Ei vielä tallennettuja aikomuksia tai pohdintoja.",
    journalOpen: "Avaa tämä päivä",
    journalIntention: "Aikomus",
    journalObservation: "Havainto",
    journalDone: "Toteutin sen",
    journalPartly: "Vähän",
    journalNotToday: "En tänään",
    mystic: "Mystikko", skeptic: "Skeptikko",
    noBirth: "Aloita antamalla syntymäpäiväsi.",
    chartHint: "Tutki hiirellä · valitse päivä napsauttamalla",
    disclaimer: "Perinteiset biorytmit ja astrologia ovat viihdettä, eivät terveysneuvoja tai luotettavia ennusteita.",
    days: "Päiviä syntymästä",
    forget: "Unohda syntymäpäivä",
    intention: "Päivän aikomus",
    curious: "Tutki jotain pientä asiaa uteliaasti.",
    kind: "Tee tilaa pienelle ystävällisyydelle.",
    pause: "Pidä yksi kiireetön hetki.",
  },
};

const quotes: Record<Locale, string[]> = {
  en: [
    "A good question can outlast a confident answer.",
    "Curiosity is a surprisingly practical form of courage.",
    "The future may be uncertain. Your next small step is not.",
  ],
  fi: [
    "Hyvä kysymys voi elää pidempään kuin varma vastaus.",
    "Uteliaisuus on yllättävän käytännöllistä rohkeutta.",
    "Tulevaisuus voi olla epävarma. Seuraava pieni askel ei ole.",
  ],
};

function localToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Keep interpretations separate from the UI and from scientific claims.
import { oracleMessage } from "./oracle";

function BiorhythmChart({ timeline, today, lang, onSelect }: { timeline: Point[]; today: string; lang: Locale; onSelect: (date: string) => void }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const tracks = [
    { key: "physical" as const, color: "#e4ad74", label: text[lang].physical },
    { key: "emotional" as const, color: "#7ec7b3", label: text[lang].emotional },
    { key: "intellectual" as const, color: "#9cb4f0", label: text[lang].intellectual },
  ];
  const width = 860, height = 190, left = 32, right = 14, top = 14, bottom = 27;
  const plotW = width - left - right, plotH = height - top - bottom;
  const x = (index: number) => left + (index / Math.max(1, timeline.length - 1)) * plotW;
  const y = (value: number) => top + (1 - (value + 100) / 200) * plotH;
  const currentIndex = timeline.findIndex((point) => point.date === today);
  const selectedIndex = hoverIndex ?? currentIndex;
  const selectedPoint = selectedIndex >= 0 ? timeline[selectedIndex] : undefined;
  const nearest = (clientX: number, rect: DOMRect) => {
    const svgX = (clientX - rect.left) / rect.width * width;
    return Math.max(0, Math.min(timeline.length - 1, Math.round((svgX - left) / plotW * (timeline.length - 1))));
  };
  return (
    <div className="chart-wrap">
      <svg
        onPointerMove={(event) => {
          if (timeline.length) setHoverIndex(nearest(event.clientX, event.currentTarget.getBoundingClientRect()));
        }}
        onPointerLeave={() => setHoverIndex(null)}
        onClick={(event) => {
          if (timeline.length) {
            onSelect(timeline[nearest(event.clientX, event.currentTarget.getBoundingClientRect())].date);
          }
        }}
        viewBox={`0 0 ${width} ${height}`} role="img" aria-label={lang === "fi" ? "Biorytmikäyrä. Valitse päivä napsauttamalla." : "Biorhythm chart. Click to select a date."} className="chart">
        {[-100, 0, 100].map((value) =>
          <g key={value}><line x1={left} x2={width-right} y1={y(value)} y2={y(value)} className="gridline" />
            <text x="4" y={y(value)+4} className="axis-text">{value}</text></g>)}
        {currentIndex >= 0 && <line x1={x(currentIndex)} x2={x(currentIndex)} y1={top} y2={height-bottom} className="today-line" />}
        {selectedIndex >= 0 && <line x1={x(selectedIndex)} x2={x(selectedIndex)} y1={top} y2={height-bottom} className="hover-line" />}
        {tracks.map(({key,color}) =>
          <polyline key={key} points={timeline.map((point,i) => `${x(i)},${y(point.values[key])}`).join(" ")}
            fill="none" stroke={color} strokeWidth="2.7" strokeLinejoin="round" strokeLinecap="round" />)}
        {timeline.filter((_,i) => i===0 || i===Math.floor(timeline.length/2) || i===timeline.length-1)
          .map((point) => {const i=timeline.indexOf(point); return <text key={point.date} x={x(i)} y={height-5}
            textAnchor={i===0 ? "start" : i===timeline.length-1 ? "end" : "middle"} className="axis-text">{point.date.slice(5)}</text>;})}
      </svg>
      {selectedPoint && <div className="chart-detail" aria-live="polite"><strong>{selectedPoint.date}</strong>{tracks.map(({key,label,color}) => <span key={key} style={{color}}>{label}: {selectedPoint.values[key] > 0 ? "+" : ""}{selectedPoint.values[key]}%</span>)}</div>}
      <div className="legend">{tracks.map(({key,color,label}) =>
        <span key={key}><i style={{background:color}} />{label}</span>)}</div>
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState<Locale>(() => localStorage.getItem("dayoracle-lang") === "fi" ? "fi" : "en");
  const [persona, setPersona] = useState<Persona>("mystic");
  const [view, setView] = useState<"oracle" | "biorhythms" | "journal">("oracle");
  const [journalQuery, setJournalQuery] = useState("");
  const [backupMessage, setBackupMessage] = useState("");
  const [birth, setBirth] = useState(() => localStorage.getItem("dayoracle-birth") ?? "");
  const [day, setDay] = useState(localToday);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [intentions, setIntentions] = useState<Record<string, string>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("dayoracle-intentions") ?? "{}");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) return saved as Record<string, string>;
    } catch { /* Ignore malformed local data. */ }
    return {};
  });
  const [reflections, setReflections] = useState(() => parseReflections(localStorage.getItem(REFLECTION_STORAGE_KEY)));
  const reflectionId = reflectionKey(birth, day);
  const reflection = reflections[reflectionId] ?? EMPTY_REFLECTION;
  const saveReflection = (change: Partial<DailyReflection>) => {
    const next = updateReflection(reflections, reflectionId, change);
    setReflections(next);
    localStorage.setItem(REFLECTION_STORAGE_KEY, JSON.stringify(next));
  };
  const clearReflection = () => {
    const next = { ...reflections };
    delete next[reflectionId];
    setReflections(next);
    localStorage.setItem(REFLECTION_STORAGE_KEY, JSON.stringify(next));
  };
  const t = text[lang];
  const intention = intentions[day] ?? "";
  const entries = useMemo(() => journalEntries(birth, intentions, reflections), [birth, intentions, reflections]);
  const filteredEntries = useMemo(() => filterJournal(entries, journalQuery), [entries, journalQuery]);
  const downloadText = (filename: string, content: string, mime: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportJournal = (format: "json" | "md") => {
    try {
      const backup = makeBackup(birth, intentions, reflections);
      if (format === "json") downloadText("dayoracle-journal.json", JSON.stringify(backup, null, 2), "application/json");
      else downloadText("dayoracle-journal.md", backupMarkdown(backup, {
        title: t.journalTitle, intention: t.journalIntention, status: t.evening, note: t.journalObservation,
      }), "text/markdown");
      setBackupMessage("");
    } catch { setBackupMessage(t.journalImportError); }
  };
  const importJournal = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2_000_000) { setBackupMessage(t.journalImportError); return; }
    try {
      const backup = parseBackup(await file.text());
      if (!window.confirm(t.journalImportConfirm)) return;
      localStorage.setItem("dayoracle-intentions", JSON.stringify(backup.intentions));
      localStorage.setItem(REFLECTION_STORAGE_KEY, JSON.stringify(backup.reflections));
      localStorage.setItem("dayoracle-birth", backup.birthDate);
      setIntentions(backup.intentions);
      setReflections(backup.reflections);
      setBirth(backup.birthDate);
      setDay(localToday());
      setBackupMessage(t.journalImportOk);
    } catch { setBackupMessage(t.journalImportError); }
  };

  useEffect(() => {
    localStorage.setItem("dayoracle-lang", lang);
  }, [lang]);

  useEffect(() => {
    if (birth) localStorage.setItem("dayoracle-birth", birth);
    else localStorage.removeItem("dayoracle-birth");
    if (!birth || birth > day) {
      setResult(null);
      setError(birth && birth > day ? "Birth date must be on or before the oracle date." : "");
      return;
    }
    let active = true;
    setError("");
    invoke<Result>("get_biorhythms", { birthDate: birth, targetDate: day })
      .then((data) => { if (active) setResult(data); })
      .catch((cause: unknown) => {
        if (active) { setResult(null); setError(String(cause)); }
      });
    return () => { active = false; };
  }, [birth, day]);

  const quote = useMemo(() => quotes[lang][Array.from(day).reduce((sum, char) => sum + char.charCodeAt(0), 0) % quotes[lang].length], [lang, day]);
  const forget = () => {
    const remaining = clearBirthReflections(reflections, birth);
    setReflections(remaining);
    localStorage.setItem(REFLECTION_STORAGE_KEY, JSON.stringify(remaining));
    setBirth("");
    setResult(null);
    setIntentions({});
    localStorage.removeItem("dayoracle-intentions");
  };
  const chooseIntention = (key: string) => {
    const next = { ...intentions, [day]: key };
    setIntentions(next);
    localStorage.setItem("dayoracle-intentions", JSON.stringify(next));
  };
  return (
    <main className="shell">
      <header className="header">
        <div className="brand"><span className="mark">☾</span><div><h1>DayOracle</h1><p>{t.tagline}</p></div></div>
        <select aria-label="Language" value={lang} onChange={(event) => setLang(event.target.value as Locale)}>
          <option value="en">English</option><option value="fi">Suomi</option>
        </select>
      </header>

      <section className="inputs" aria-label="Oracle settings">
        <label>{t.birth}<input type="date" value={birth} max={day} onChange={(event) => setBirth(event.target.value)} /></label>
        <label>{t.date}<input type="date" value={day} min={birth || undefined} onChange={(event) => setDay(event.target.value)} /></label>
        <label>{lang === "fi" ? "Oraakkeli" : "Oracle persona"}
          <select value={persona} onChange={(event) => setPersona(event.target.value as Persona)}>
            <option value="mystic">{t.mystic}</option><option value="skeptic">{t.skeptic}</option>
          </select>
        </label>
        <button type="button" className="muted-button view-switch" aria-pressed={view === "biorhythms"}
          onClick={() => setView(view === "biorhythms" ? "oracle" : "biorhythms")}>
          {view === "biorhythms" ? t.backToOracle : t.showBiorhythms}
        </button>
        <button type="button" className="muted-button journal-switch" aria-pressed={view === "journal"}
          onClick={() => setView(view === "journal" ? "oracle" : "journal")}>
          {view === "journal" ? t.backToOracle : t.journal}
        </button>
        <button type="button" className="muted-button" onClick={() => setDay(localToday())}>{t.backToToday}</button>
        {birth && <button className="muted-button" onClick={forget}>{t.forget}</button>}
      </section>

      {!birth && <section className="panel empty"><h2>{t.noBirth}</h2><p>{t.disclaimer}</p></section>}
      {error && <section className="panel error" role="alert">{error}</section>}
      {result && !error && view === "oracle" && <>
        <section className="hero panel">
          <div className="eyebrow">✦ {t.perspective}</div>
          <h2>{oracleMessage(result.values, persona, lang, day, birth)}</h2>
          <p className="subtle">{t.days}: {result.daysLived.toLocaleString(lang)}</p>
        </section>
        <section className="bottom-grid">
          <div className="panel">
            <div className="eyebrow">✧ {t.quote}</div>
            <p className="quote">“{quote}”</p>
            <small>— DayOracle</small>
            <div className="reflection-question">
              <div className="eyebrow">✦ {t.question}</div>
              <p>{dailyQuestion(lang, persona, day, birth)}</p>
            </div>
          </div>
          <div className="panel">
            <div className="eyebrow">☀ {t.intention}</div>
            <div className="intentions">
              {(["curious","kind","pause"] as const).map((key) =>
                <button type="button" className={intention===key?"intent active":"intent"} key={key}
                  onClick={() => chooseIntention(key)} aria-pressed={intention===key}>{t[key]}</button>)}
            </div>
            {intention && <p className="intention-saved" role="status">✓ {t.intentionSaved}</p>}
          </div>
        </section>
        <section className="panel evening-panel" aria-label={t.evening}>
          <div className="eyebrow">☾ {t.evening}</div>
          <p className="evening-prompt">{t.eveningPrompt}</p>
          <div className="evening-options">
            {([
              ["done", t.eveningDone],
              ["partly", t.eveningPartly],
              ["not-today", t.eveningNotToday],
            ] as const).map(([value, label]) => (
              <button type="button" key={value} className={reflection.status === value ? "intent active" : "intent"}
                aria-pressed={reflection.status === value}
                onClick={() => saveReflection({ status: value })}>{label}</button>
            ))}
          </div>
          <label className="evening-note">{t.eveningNote}
            <textarea rows={2} maxLength={500} value={reflection.note}
              placeholder={t.eveningPlaceholder}
              onChange={(event) => saveReflection({ note: event.target.value })} />
          </label>
          {(reflection.status || reflection.note) && <div className="evening-actions">
            <span role="status">✓ {t.eveningSaved}</span>
            <button type="button" className="evening-clear" onClick={clearReflection}>{t.eveningClear}</button>
          </div>}
        </section>
      </>}
      {birth && !error && view === "journal" && <section className="panel journal-panel">
        <div className="eyebrow">✦ {t.journal}</div>
        <h2>{t.journalTitle}</h2>
        <div className="journal-tools">
          <label>{t.journalSearch}
            <input type="search" value={journalQuery} placeholder={t.journalSearchPlaceholder}
              onChange={(event) => setJournalQuery(event.target.value)} />
          </label>
          <div className="journal-buttons">
            <button type="button" className="muted-button" onClick={() => exportJournal("json")}>{t.journalExportJson}</button>
            <button type="button" className="muted-button" onClick={() => exportJournal("md")}>{t.journalExportMd}</button>
            <label className="muted-button journal-import">{t.journalImport}
              <input type="file" accept=".json,application/json" onChange={(event) => {
                void importJournal(event.target.files?.[0]);
                event.target.value = "";
              }} />
            </label>
          </div>
          <small>{t.journalBackupNote}</small>
          {backupMessage && <p role="status">{backupMessage}</p>}
        </div>
        {entries.length === 0 ? <p className="subtle">{t.journalEmpty}</p> :
          filteredEntries.length === 0 ? <p className="subtle">{t.journalNoMatches}</p> :
          <div className="journal-list">
            {filteredEntries.map((entry) => (
              <article className="journal-entry" key={entry.date}>
                <div className="journal-entry-header">
                  <strong>{entry.date}</strong>
                  <button type="button" className="muted-button" onClick={() => { setDay(entry.date); setView("oracle"); }}>
                    {t.journalOpen}
                  </button>
                </div>
                {entry.intention && <p><span>{t.journalIntention}: </span>{t[entry.intention as "curious" | "kind" | "pause"] ?? entry.intention}</p>}
                {entry.status && <p><span>{t.evening}: </span>{entry.status === "done" ? t.journalDone : entry.status === "partly" ? t.journalPartly : t.journalNotToday}</p>}
                {entry.note && <p className="journal-note"><span>{t.journalObservation}: </span>{entry.note}</p>}
              </article>
            ))}
          </div>}
      </section>}
      {result && !error && view === "biorhythms" && <>
        <div className="biorhythm-heading">
          <h2>{t.showBiorhythms}</h2>
          <p>{t.days}: {result.daysLived.toLocaleString(lang)}</p>
        </div>
        <section className="score-grid">
          {(["physical","emotional","intellectual"] as const).map((name) =>
            <div className="score panel" key={name}>
              <span>{t[name]}</span><strong>{result.values[name] > 0 ? "+" : ""}{result.values[name]}%</strong>
              <div className="score-track"><div style={{width:`${(result.values[name]+100)/2}%`}} /></div>
            </div>)}
        </section>
        <section className="panel">
          <div className="chart-heading"><h3>{t.timeline}</h3><span>{t.chartHint}</span></div>
          <BiorhythmChart timeline={result.timeline} today={result.date} lang={lang} onSelect={setDay} />
        </section>
      </>}
      <footer>{t.disclaimer} · v0.1.0-alpha.1</footer>
    </main>
  );
}
