import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useEffect, useMemo, useRef, useState } from "react";
import { createVault, unlockVault, writeVault, deleteVault, vaultExists, changeVaultPassword, exportEncryptedVault, previewEncryptedVault, type VaultStatus, type VaultState } from "./vault-client";
import { dailyQuestion } from "./reflection";
import { addForecast, mayAssess, assessForecast, type ForecastHistory, type ForecastRating, type AssessmentTime, validAssessmentTime } from "./forecast-history";
import { VaultSaveQueue } from "./vault-save-queue";
import { journalEntries } from "./journal";
import { backupMarkdown, filterJournal, makeBackup, parseBackup } from "./journal-backup";
import { EMPTY_REFLECTION, parseReflections, reflectionKey, REFLECTION_STORAGE_KEY, updateReflection, type DailyReflection } from "./evening-reflection";


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
    eveningSaved: "Saved privately on this device", savePending: "Unsaved changes", saveSaving: "Encrypting and saving…", saveError: "Save failed — do not close",
    eveningClear: "Clear this reflection",
    timeline: "Your cosmic curves",
    showBiorhythms: "Daily biorhythms",
    backToOracle: "Back to oracle",
    journal: "Journal",
    journalTitle: "Your days, in your own words",
    settings: "Settings", settingsClose: "Close settings", passwordSettings: "Change password", protect: "Protect journal", vaultPassword: "Password", vaultConfirm: "Confirm password", vaultCreate: "Enable encryption", vaultUnlock: "Unlock", vaultLock: "Lock journal", vaultLocked: "Journal locked", vaultWarning: "No password recovery is available. Keep your password safe.", vaultMismatch: "Passwords must match and contain at least 12 characters.", vaultError: "Vault operation failed. Check your password or try again.", vaultNew: "New password", vaultNewConfirm: "Confirm new password", vaultChanged: "Password changed successfully.", vaultChange: "Change password", vaultEncryptedExport: "Export encrypted backup", vaultExportHint: "Encrypted backups use the journal password active at the time of export.", vaultEncryptedImport: "Restore encrypted backup", vaultBackupPassword: "Backup password", vaultChooseFile: "Choose encrypted JSON file…", vaultChooseFileDisabled: "Enter backup password first", vaultImportConfirm: "Replace the current encrypted journal with this backup? This cannot be undone.", vaultImportOk: "Encrypted backup restored", vaultImportError: "Restore failed. Check the backup password and file.", vaultPlainWarning: "This export is NOT encrypted. Continue?",
    journalSearch: "Search journal",
    journalClear: "Clear journal",
    journalClearConfirm: "Delete all saved intentions and reflections on this device? Your birth date and settings will be kept. This cannot be undone.",
    journalClearDone: "Journal cleared",
    dangerZone: "Danger zone", resetAll: "Start over", resetDescription: "Delete all local journal data, birth date and encryption password. External backups remain untouched.", resetPassword: "Current journal password", resetConfirm: "Type DELETE to confirm", resetConfirmWord: "DELETE", resetWarning: "This permanently removes all local DayOracle journal data and password protection. External backups are not deleted. Continue?", resetDone: "DayOracle was reset. You can start again.", resetError: "Reset failed. Your journal has not been cleared in the interface.", forgetHint: "Only the birth date will be forgotten. Journal entries and encryption remain.",
    journalExportOk: "Export saved",
    journalExportError: "Could not save export",
    journalSearchPlaceholder: "Search dates, intentions or notes…",
    journalExportJson: "Export JSON backup",
    journalExportMd: "Export Markdown",
    journalImport: "Restore JSON backup",
    journalImportConfirm: "Replace the current journal and birth date with this backup? This cannot be undone.",
    journalImportOk: "Backup restored",
    journalImportError: "Backup could not be restored", journalEncryptedImportHint: "This is an encrypted backup. Restore it in Settings → Restore encrypted backup.",
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
    eveningSaved: "Tallennettu yksityisesti tälle laitteelle", savePending: "Tallentamattomia muutoksia", saveSaving: "Salataan ja tallennetaan…", saveError: "Tallennus epäonnistui — älä sulje",
    eveningClear: "Tyhjennä tämä pohdinta",
    timeline: "Kosmiset käyräsi",
    showBiorhythms: "Päivän biorytmit",
    backToOracle: "Takaisin oraakkeliin",
    journal: "Päiväkirja",
    journalTitle: "Omat päiväsi, omin sanoin",
    settings: "Asetukset", settingsClose: "Sulje asetukset", passwordSettings: "Vaihda salasana", protect: "Suojaa päiväkirja", vaultPassword: "Salasana", vaultConfirm: "Vahvista salasana", vaultCreate: "Ota salaus käyttöön", vaultUnlock: "Avaa", vaultLock: "Lukitse päiväkirja", vaultLocked: "Päiväkirja lukittu", vaultWarning: "Salasanaa ei voi palauttaa. Säilytä se huolellisesti.", vaultMismatch: "Salasanojen on täsmättävä ja oltava vähintään 12 merkkiä.", vaultError: "Salaustoiminto epäonnistui. Tarkista salasana tai yritä uudelleen.", vaultNew: "Uusi salasana", vaultNewConfirm: "Vahvista uusi salasana", vaultChanged: "Salasana vaihdettu onnistuneesti.", vaultChange: "Vaihda salasana", vaultEncryptedExport: "Vie salattu varmuuskopio", vaultExportHint: "Salattu varmuuskopio käyttää vientihetkellä voimassa olevaa päiväkirjan salasanaa.", vaultEncryptedImport: "Palauta salattu varmuuskopio", vaultBackupPassword: "Varmuuskopion salasana", vaultChooseFile: "Valitse salattu JSON-tiedosto…", vaultChooseFileDisabled: "Anna ensin varmuuskopion salasana", vaultImportConfirm: "Korvataanko nykyinen salattu päiväkirja tällä varmuuskopiolla? Tätä ei voi perua.", vaultImportOk: "Salattu varmuuskopio palautettu", vaultImportError: "Palautus epäonnistui. Tarkista varmuuskopion salasana ja tiedosto.", vaultPlainWarning: "Tämä vienti EI ole salattu. Jatketaanko?",
    journalSearch: "Hae päiväkirjasta",
    journalClear: "Tyhjennä päiväkirja",
    journalClearConfirm: "Poistetaanko kaikki tälle laitteelle tallennetut aikomukset ja pohdinnat? Syntymäpäivä ja asetukset säilyvät. Tätä ei voi perua.",
    journalClearDone: "Päiväkirja tyhjennetty",
    dangerZone: "Vaaralliset toiminnot", resetAll: "Aloita alusta", resetDescription: "Poistaa paikallisen päiväkirjan, syntymäpäivän ja salasanasuojauksen. Erilliset varmuuskopiot säilyvät.", resetPassword: "Päiväkirjan nykyinen salasana", resetConfirm: "Kirjoita POISTA vahvistukseksi", resetConfirmWord: "POISTA", resetWarning: "Tämä poistaa pysyvästi paikallisen DayOracle-päiväkirjan ja salasanasuojauksen. Erillisiä varmuuskopioita ei poisteta. Jatketaanko?", resetDone: "DayOracle nollattu. Voit aloittaa alusta.", resetError: "Nollaus epäonnistui. Käyttöliittymän päiväkirjatietoja ei tyhjennetty.", forgetHint: "Vain syntymäpäivä unohdetaan. Päiväkirja ja salaus säilyvät.",
    journalExportOk: "Vientitiedosto tallennettu",
    journalExportError: "Vientitiedoston tallennus epäonnistui",
    journalSearchPlaceholder: "Hae päivämääriä, aikomuksia tai havaintoja…",
    journalExportJson: "Vie JSON-varmuuskopio",
    journalExportMd: "Vie Markdown",
    journalImport: "Palauta JSON-varmuuskopio",
    journalImportConfirm: "Korvataanko nykyinen päiväkirja ja syntymäpäivä varmuuskopiolla? Tätä ei voi perua.",
    journalImportOk: "Varmuuskopio palautettu",
    journalImportError: "Varmuuskopion palautus epäonnistui", journalEncryptedImportHint: "Tämä on salattu varmuuskopio. Palauta se kohdasta Asetukset → Palauta salattu varmuuskopio.",
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
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [vaultStatus, setVaultStatus] = useState<VaultStatus>("checking");
  const [vaultPassword, setVaultPassword] = useState("");
  const [vaultConfirm, setVaultConfirm] = useState("");
  const [vaultNew, setVaultNew] = useState("");
  const [vaultNewConfirm, setVaultNewConfirm] = useState("");
  const [passwordChangeMessage, setPasswordChangeMessage] = useState("");
  const [backupPassword, setBackupPassword] = useState("");
  const [backupImportOpen, setBackupImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [assessmentTime, setAssessmentTime] = useState<AssessmentTime>(() => {
    const stored = localStorage.getItem("dayoracle-assessment-time") ?? "18:00";
    return validAssessmentTime(stored) ? stored as AssessmentTime : "18:00";
  });
  const [clockNow, setClockNow] = useState(() => new Date());
  useEffect(() => {
    // Refresh on the next minute boundary, including when the application stays open.
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setClockNow(new Date());
      timer = setTimeout(tick, 60_000 - Date.now() % 60_000 + 50);
    };
    timer = setTimeout(tick, 60_000 - Date.now() % 60_000 + 50);
    return () => clearTimeout(timer);
  }, []);
  const changeAssessmentTime = (value: string) => {
    if (!validAssessmentTime(value)) return;
    setAssessmentTime(value as AssessmentTime);
    localStorage.setItem("dayoracle-assessment-time", value);
    setClockNow(new Date());
  };

  const [passwordSettingsOpen, setPasswordSettingsOpen] = useState(false);
  const [vaultError, setVaultError] = useState("");
  const [vaultBusy, setVaultBusy] = useState(false);
  const secret = useRef<string | null>(null);
  const statusRef = useRef<VaultStatus>("checking");
  const [saveState, setSaveState] = useState<"saved" | "pending" | "saving" | "error">("saved");
  const closeInProgress = useRef(false);
  const saveQueue = useRef<VaultSaveQueue<VaultState> | null>(null);
  if (!saveQueue.current) {
    saveQueue.current = new VaultSaveQueue(async snapshot => {
      const password = secret.current;
      if (!password || statusRef.current !== "unlocked") throw new Error("Vault is locked");
      await writeVault(password, snapshot);
    });
  }
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushVault = async () => {
    if (saveTimer.current !== null) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    const queue = saveQueue.current!;
    if (!queue.dirty) return;
    setSaveState("saving");
    try {
      await queue.flush();
      setSaveState("saved");
    } catch {
      setSaveState("error");
      setVaultError(text[lang].vaultError);
      throw new Error("Encrypted journal save failed");
    }
  };
  useEffect(() => () => {
    if (saveTimer.current !== null) clearTimeout(saveTimer.current);
  }, []);
  // Intercept ordinary window closure until encrypted writes have reached disk.
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void getCurrentWindow().onCloseRequested(async event => {
      event.preventDefault();
      if (closeInProgress.current) return;
      closeInProgress.current = true;
      try {
        if (statusRef.current === "unlocked") await flushVault();
        if (!disposed) await getCurrentWindow().destroy();
      } catch {
        closeInProgress.current = false;
        setVaultError(text[lang].vaultError);
        window.alert(lang === "fi"
          ? "Päiväkirjan tallennus epäonnistui. Ikkunaa ei suljettu, jotta tiedot eivät katoaisi."
          : "Journal save failed. The window was kept open to protect your changes.");
      }
    }).then(fn => { if (disposed) fn(); else unlisten = fn; })
      .catch(() => setVaultError("Window close protection could not be installed."));
    return () => { disposed = true; unlisten?.(); };
  }, []);
  const lastBirth = useRef<string | null>(null);
  const setStatus = (status: VaultStatus) => { statusRef.current = status; setVaultStatus(status); };

  const [birth, setBirth] = useState(() => localStorage.getItem("dayoracle-birth") ?? "");
  const validBirthInput = (value: string) => value === "" || (/^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "1800-01-01" && value <= localToday() && !Number.isNaN(new Date(value + "T12:00:00").getTime()) && new Date(value + "T12:00:00").toISOString().slice(0, 10) === value);
  const [birthDraft, setBirthDraft] = useState(birth);
  const [birthInputError, setBirthInputError] = useState("");
  useEffect(() => { setBirthDraft(birth); setBirthInputError(""); }, [birth]);
  const commitBirthDraft = () => {
    if (!validBirthInput(birthDraft) || (birthDraft === "" && birth !== "")) {
      setBirthInputError(lang === "fi" ? "Virheellinen syntymäpäivä. Valitse päivämäärä väliltä 1.1.1800–tänään." : "Invalid birth date. Choose a date from 1800-01-01 through today.");
      return;
    }
    setBirthInputError("");
    if (birthDraft !== birth) setBirth(birthDraft);
  };
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
  const [forecasts, setForecasts] = useState<ForecastHistory>(() => {
    try { return parseBackup(localStorage.getItem("dayoracle-forecast-backup") ?? "").forecasts; }
    catch { return {}; }
  });
  const forecastsRef = useRef(forecasts);
  forecastsRef.current = forecasts;
  const t = text[lang];
  const persist = (state: VaultState) => {
    if (!validBirthInput(state.birthDate)) return;
    state = { ...state, forecasts: state.forecasts ?? forecastsRef.current };
    if (statusRef.current === "unlocked" && secret.current) {
      saveQueue.current!.stage(state);
      setSaveState("pending");
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void flushVault().catch(() => { /* Keep the journal unlocked on write failure. */ });
      }, 900);
    } else if (statusRef.current === "unprotected") {
      localStorage.setItem("dayoracle-intentions", JSON.stringify(state.intentions));
      localStorage.setItem(REFLECTION_STORAGE_KEY, JSON.stringify(state.reflections));
      localStorage.setItem("dayoracle-forecast-backup", JSON.stringify(makeBackup(state.birthDate, state.intentions, state.reflections, state.forecasts)));
    }
  };
  useEffect(() => {
    let active = true;
    vaultExists().then(exists => {
      if (!active) return;
      if (exists) {
        localStorage.removeItem("dayoracle-intentions");
        localStorage.removeItem(REFLECTION_STORAGE_KEY);
        localStorage.removeItem("dayoracle-birth");
        localStorage.removeItem("dayoracle-forecast-backup");
        setBirth(""); setIntentions({}); setReflections({}); setForecasts({});
        setStatus("locked");
      } else setStatus("unprotected");
    }).catch(() => { if (active) setVaultError("Vault detection failed. Restart DayOracle."); });
    return () => { active = false; };
  }, []);
  const enableVault = async () => {
    if (vaultBusy || vaultStatus !== "unprotected") return;
    if (vaultPassword.length < 12 || vaultPassword !== vaultConfirm) { setVaultError(t.vaultMismatch); return; }
    setVaultBusy(true); setVaultError("");
    try {
      await createVault(vaultPassword, { birthDate: birth, intentions, reflections, forecasts });
      secret.current = vaultPassword;
      localStorage.removeItem("dayoracle-intentions");
      localStorage.removeItem(REFLECTION_STORAGE_KEY);
      localStorage.removeItem("dayoracle-birth");
      setStatus("unlocked"); setVaultPassword(""); setVaultConfirm("");
    } catch { setVaultError(t.vaultError); } finally { setVaultBusy(false); }
  };
  const openVault = async () => {
    if (vaultBusy || vaultStatus !== "locked") return;
    setVaultBusy(true); setVaultError("");
    try {
      const data = await unlockVault(vaultPassword);
      secret.current = vaultPassword;
      setBirth(data.birthDate); setIntentions(data.intentions); setReflections(data.reflections); setForecasts(data.forecasts ?? {});
      setVaultPassword(""); lastBirth.current = data.birthDate; setStatus("unlocked");
    } catch { setVaultError(t.vaultError); } finally { setVaultBusy(false); }
  };
  const lockVault = async () => {
    if (vaultBusy || vaultStatus !== "unlocked") return;
    setVaultBusy(true); setVaultError("");
    try { await flushVault(); } catch { setVaultBusy(false); return; }
    secret.current = null; setBirth(""); setIntentions({}); setReflections({}); setForecasts({});
    setVaultPassword(""); setVaultNew(""); setBackupPassword(""); setBackupImportOpen(false); setJournalQuery(""); setSettingsOpen(false); setPasswordSettingsOpen(false); lastBirth.current = null; setStatus("locked");
    setVaultBusy(false);
  };
  const updatePassword = async () => {
    if (vaultBusy || vaultStatus !== "unlocked") return;
    if (vaultNew.length < 12 || vaultNew !== vaultNewConfirm) { setVaultError(t.vaultMismatch); setPasswordChangeMessage(""); return; }
    setVaultBusy(true); setVaultError(""); setPasswordChangeMessage("");
    try {
      await flushVault();
      await changeVaultPassword(secret.current ?? "", vaultNew);
      secret.current = vaultNew; setVaultNew(""); setVaultNewConfirm("");
      setPasswordChangeMessage(t.vaultChanged);
    } catch { setVaultError(t.vaultError); } finally { setVaultBusy(false); }
  };
  const exportVault = async () => {
    if (vaultStatus !== "unlocked") return;
    try {
      await flushVault();
      const data = await exportEncryptedVault(secret.current ?? "");
      const destination = await save({ defaultPath: "dayoracle-journal.encrypted.json" });
      if (destination) { await writeTextFile(destination, data); setBackupMessage(t.journalExportOk); }
    } catch { setVaultError(t.vaultError); }
  };
  const restoreEncryptedVault = async (file: File | undefined) => {
    if (!file || vaultStatus !== "unlocked" || vaultBusy) return;
    if (file.size > 4_000_000) { setVaultError(t.vaultImportError); return; }
    setVaultBusy(true); setVaultError(""); setBackupMessage("");
    try {
      const data = await previewEncryptedVault(backupPassword, await file.text());
      if (!window.confirm(t.vaultImportConfirm)) return;
      await flushVault();
      await writeVault(secret.current ?? "", data);
      lastBirth.current = data.birthDate;
      setBirth(data.birthDate); setIntentions(data.intentions); setReflections(data.reflections); setForecasts(data.forecasts ?? {});
      setDay(localToday());
      setBackupPassword(""); setBackupImportOpen(false);
      setBackupMessage(t.vaultImportOk);
    } catch (error) { console.error("Encrypted backup restore failed:", error); setVaultError(t.vaultImportError); }
    finally { setVaultBusy(false); }
  };
  const reflectionId = reflectionKey(birth, day);
  const reflection = reflections[reflectionId] ?? EMPTY_REFLECTION;
  const saveReflection = (change: Partial<DailyReflection>) => {
    const next = updateReflection(reflections, reflectionId, change);
    setReflections(next);
    persist({ birthDate: birth, intentions, reflections: next });
  };
  const clearReflection = () => {
    const next = { ...reflections };
    delete next[reflectionId];
    setReflections(next);
    persist({ birthDate: birth, intentions, reflections: next });
  };
  const saveLabel = vaultStatus === "unlocked" && saveState !== "saved" ? (saveState === "pending" ? t.savePending : saveState === "saving" ? t.saveSaving : t.saveError) : null;
  const intention = intentions[day] ?? "";
  const entries = useMemo(() => journalEntries(birth, intentions, reflections), [birth, intentions, reflections]);
  const filteredEntries = useMemo(() => filterJournal(entries, journalQuery), [entries, journalQuery]);
  const exportJournal = async (format: "json" | "md") => {
    try {
      if (vaultStatus === "unlocked" && !window.confirm(t.vaultPlainWarning)) return;
      if (vaultStatus === "unlocked") await flushVault();
      const backup = makeBackup(birth, intentions, reflections, forecasts);
      const filename = format === "json" ? "dayoracle-journal.json" : "dayoracle-journal.md";
      const destination = await save({
        defaultPath: filename,
      });
      if (!destination) return;
      const content = format === "json" ? JSON.stringify(backup, null, 2) :
        backupMarkdown(backup, {
          title: t.journalTitle, intention: t.journalIntention, status: t.evening, note: t.journalObservation,
        });
      await writeTextFile(destination, content);
      setBackupMessage(t.journalExportOk);
    } catch { setBackupMessage(t.journalExportError); }
  };
  const clearJournal = async () => {
    if (vaultBusy || !window.confirm(t.journalClearConfirm)) return;
    setVaultBusy(true);
    try {
      const empty = { birthDate: birth, intentions: {}, reflections: {}, forecasts: {} };
      if (vaultStatus === "unlocked") {
        await flushVault();
        await writeVault(secret.current ?? "", empty);
      } else {
        localStorage.removeItem("dayoracle-intentions");
        localStorage.removeItem(REFLECTION_STORAGE_KEY);
      }
      setIntentions({});
      setReflections({});
      setForecasts({});
      localStorage.removeItem("dayoracle-forecast-backup");
      setJournalQuery("");
      setBackupMessage(t.journalClearDone);
    } catch (error) {
      console.error("Journal clear failed:", error);
      setVaultError(t.vaultError);
    } finally {
      setVaultBusy(false);
    }
  };
  const resetAll = async () => {
    if (vaultBusy || resetConfirmation !== t.resetConfirmWord ||
        (vaultStatus === "unlocked" && !resetPassword)) return;
    if (!window.confirm(t.resetWarning)) return;
    setVaultBusy(true);
    setVaultError("");
    try {
      if (vaultStatus === "unlocked") {
        await flushVault();
        await deleteVault(resetPassword);
      }
      if (saveTimer.current !== null) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      secret.current = null;
      localStorage.removeItem("dayoracle-birth");
      localStorage.removeItem("dayoracle-intentions");
      localStorage.removeItem(REFLECTION_STORAGE_KEY);
      localStorage.removeItem("dayoracle-forecast-backup");
      lastBirth.current = null;
      setStatus("unprotected");
      setBirth("");
      setIntentions({});
      setReflections({});
      setForecasts({});
      setResult(null);
      setJournalQuery("");
      setVaultPassword("");
      setVaultConfirm("");
      setVaultNew("");
      setVaultNewConfirm("");
      setBackupPassword("");
      setResetPassword("");
      setResetConfirmation("");
      setResetOpen(false);
      setPasswordSettingsOpen(false);
      setBackupImportOpen(false);
      setBackupMessage(t.resetDone);
    } catch (error) {
      console.error("DayOracle reset failed:", error);
      setVaultError(t.resetError);
    } finally {
      setVaultBusy(false);
    }
  };
  const importJournal = async (file: File | undefined) => {
    if (!file || vaultBusy) return;
    if (file.size > 2_000_000) { setBackupMessage(t.journalImportError); return; }
    setBackupMessage("");
    try {
      const raw = await file.text();
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && "format" in parsed &&
          (parsed as { format?: unknown }).format === "dayoracle-encrypted-journal") {
        setBackupMessage(t.journalEncryptedImportHint);
        return;
      }
      const backup = parseBackup(raw);
      if (!window.confirm(t.journalImportConfirm)) return;
      const restored = { birthDate: backup.birthDate, intentions: backup.intentions, reflections: backup.reflections, forecasts: backup.forecasts };
      if (vaultStatus === "unlocked") {
        setVaultBusy(true);
        try {
          await flushVault();
          await writeVault(secret.current ?? "", restored);
          lastBirth.current = restored.birthDate;
        } finally {
          setVaultBusy(false);
        }
      } else if (vaultStatus === "unprotected") {
        localStorage.setItem("dayoracle-intentions", JSON.stringify(restored.intentions));
        localStorage.setItem(REFLECTION_STORAGE_KEY, JSON.stringify(restored.reflections));
        localStorage.setItem("dayoracle-forecast-backup", JSON.stringify(backup));
        localStorage.setItem("dayoracle-birth", restored.birthDate);
      } else {
        throw new Error("Journal unavailable");
      }
      setIntentions(restored.intentions);
      setReflections(restored.reflections);
      setForecasts(restored.forecasts);
      setBirth(restored.birthDate);
      setDay(localToday());
      setBackupMessage(t.journalImportOk);
    } catch (error) {
      console.error("Plain JSON backup restore failed:", error);
      setBackupMessage(t.journalImportError);
    }
  };

  useEffect(() => {
    localStorage.setItem("dayoracle-lang", lang);
  }, [lang]);

  useEffect(() => {
    if (!validBirthInput(birth)) {
      setResult(null);
      setError(lang === "fi" ? "Tarkista syntymäpäivä (aikaisintaan 1.1.1800)." : "Check birth date (earliest 1800-01-01).");
      return;
    }
    if (statusRef.current === "unlocked" && lastBirth.current !== null && lastBirth.current !== birth) {
      persist({ birthDate: birth, intentions, reflections });
    }
    lastBirth.current = birth;
    if (statusRef.current === "unprotected") {
      if (birth) localStorage.setItem("dayoracle-birth", birth);
      else localStorage.removeItem("dayoracle-birth");
    }
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

  // Only a forecast actually viewed today is recorded; never backfill missed dates.
  useEffect(() => {
    if (vaultStatus !== "unprotected" && vaultStatus !== "unlocked") return;
    if (view !== "oracle" || !result || error || !birth || day !== localToday()) return;
    if (forecastsRef.current[day]) return;
    const now = new Date();
    const snapshot = { date: day, birthDateAtCreation: birth, persona, locale: lang,
      message: oracleMessage(result.values, persona, lang, day, birth), createdAt: now.toISOString() };
    const next = addForecast(forecastsRef.current, snapshot);
    if (next === forecastsRef.current) return;
    // Stage synchronously so a quick persona/language change cannot overwrite the first snapshot.
    forecastsRef.current = next;
    try {
      persist({ birthDate: birth, intentions, reflections, forecasts: next });
      setForecasts(next);
    } catch (cause) {
      forecastsRef.current = forecasts;
      setVaultError(String(cause));
    }
  }, [vaultStatus, view, result, error, birth, day, persona, lang]);

  const savedForecast = forecasts[day];
  const [assessmentNote, setAssessmentNote] = useState("");
  const [assessmentRating, setAssessmentRating] = useState<ForecastRating>("unsure");
  const [assessmentError, setAssessmentError] = useState("");
  const [assessmentFeedback, setAssessmentFeedback] = useState<"idle" | "saving" | "saved">("idle");
  useEffect(() => {
    setAssessmentRating(savedForecast?.assessment?.rating ?? "unsure");
    setAssessmentNote(savedForecast?.assessment?.note ?? "");
    setAssessmentError("");
    setAssessmentFeedback("idle");
  }, [day, savedForecast?.assessment?.updatedAt]);
  const saveAssessment = async () => {
    if (!savedForecast || assessmentFeedback === "saving") return;
    setAssessmentFeedback("saving");
    setAssessmentError("");
    try {
      const next = assessForecast(forecastsRef.current, day, assessmentRating, assessmentNote, new Date(), assessmentTime);
      persist({ birthDate: birth, intentions, reflections, forecasts: next });
      forecastsRef.current = next;
      setForecasts(next);
      // A vault write must reach disk before showing a success message.
      if (statusRef.current === "unlocked") await flushVault();
      setAssessmentFeedback("saved");
    } catch (cause) {
      setAssessmentFeedback("idle");
      setAssessmentError(String(cause));
    }
  };

  const quote = useMemo(() => quotes[lang][Array.from(day).reduce((sum, char) => sum + char.charCodeAt(0), 0) % quotes[lang].length], [lang, day]);
  const forget = () => {
    if (vaultBusy || !window.confirm(t.forgetHint)) return;
    // Keep the existing journal entries and reflections, even when the birth date is cleared.
    // The birth-date effect stages the new state for encrypted journals.
    setBirth("");
    setResult(null);
  };
  const chooseIntention = (key: string) => {
    const next = { ...intentions, [day]: key };
    setIntentions(next);
    persist({ birthDate: birth, intentions: next, reflections });
  };
  return (
    <main className="shell">
      <header className="header">
        <div className="brand"><span className="mark">☾</span><div><h1>DayOracle</h1><p>{t.tagline}</p></div></div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <select aria-label="Language" value={lang} onChange={(event) => setLang(event.target.value as Locale)}>
            <option value="en">English</option><option value="fi">Suomi</option>
          </select>
          {vaultStatus !== "checking" && vaultStatus !== "locked" && <button type="button"
            className="muted-button" aria-label={t.settings} title={t.settings}
            aria-expanded={settingsOpen} aria-controls="dayoracle-settings"
            onClick={() => { setSettingsOpen(!settingsOpen); setPasswordSettingsOpen(false); setVaultError(""); }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/>
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.86 1.86-.06-.06A1.7 1.7 0 0 0 16 18.4a1.7 1.7 0 0 0-1 1.57V21h-2.6v-.09a1.7 1.7 0 0 0-1.13-1.6 1.7 1.7 0 0 0-1.85.36l-.06.06-1.86-1.86.06-.06A1.7 1.7 0 0 0 7.2 16a1.7 1.7 0 0 0-1.57-1H4.5v-2.6h.09a1.7 1.7 0 0 0 1.6-1.13 1.7 1.7 0 0 0-.36-1.85l-.06-.06L7.63 7.5l.06.06A1.7 1.7 0 0 0 9.5 7.2a1.7 1.7 0 0 0 1-1.57V4.5h2.6v.09a1.7 1.7 0 0 0 1.13 1.6 1.7 1.7 0 0 0 1.85-.36l.06-.06L18 7.63l-.06.06A1.7 1.7 0 0 0 17.6 9.5a1.7 1.7 0 0 0 1.57 1h1.33v2.6h-.09A1.7 1.7 0 0 0 19.4 15Z" transform="translate(-.5 -.5)"/>
            </svg>
          </button>}
        </div>
      </header>

      {vaultStatus === "checking" && <section className="panel"><p>Checking journal security…</p>{vaultError && <p role="alert">{vaultError}</p>}</section>}
      {vaultStatus === "locked" && <section className="panel journal-panel">
        <h2>{t.vaultLocked}</h2><p>{t.vaultWarning}</p>
        <div style={{ display: "grid", gap: "0.75rem", maxWidth: "360px", marginTop: "1rem" }}>
          <label style={{ display: "grid", gap: "0.4rem" }}>{t.vaultPassword}
            <input type="password" autoComplete="off" value={vaultPassword}
              onChange={e => setVaultPassword(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void openVault(); }} />
          </label>
          <button type="button" disabled={vaultBusy} onClick={() => { void openVault(); }}>{t.vaultUnlock}</button>
        </div>
        {vaultError && <p role="alert">{vaultError}</p>}
      </section>}
      {(vaultStatus === "unprotected" || vaultStatus === "unlocked") && <>
      {settingsOpen && <section id="dayoracle-settings" className="panel journal-panel" aria-label={t.settings}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>{t.settings}</h2>
          <button type="button" className="muted-button" aria-label={t.settingsClose} title={t.settingsClose} style={{ borderRadius: "50%", width: "2.4rem", height: "2.4rem", padding: 0, display: "grid", placeItems: "center", fontSize: "1.15rem" }} onClick={() => { setSettingsOpen(false); setPasswordSettingsOpen(false); setBackupImportOpen(false); setPasswordChangeMessage(""); setVaultError(""); }}>×</button>
        </div>
        <div style={{ marginTop: "1rem", marginBottom: "1rem" }}>
          <label style={{ display: "grid", gap: "0.4rem", maxWidth: "360px" }}>
            {lang === "fi" ? "Päivän arviointiaika" : "Daily assessment time"}
            <select value={assessmentTime} onChange={e => changeAssessmentTime(e.target.value)}>
              <option value="15:00">{lang === "fi" ? "15.00 – Työpäivän jälkeen" : "15:00 – After work"}</option>
              <option value="18:00">{lang === "fi" ? "18.00 – Oletus" : "18:00 – Default"}</option>
              <option value="21:00">{lang === "fi" ? "21.00 – Illalla" : "21:00 – Evening"}</option>
              <option value="any">{lang === "fi" ? "Milloin tahansa" : "Anytime"}</option>
            </select>
          </label>
          <p className="subtle">{lang === "fi"
            ? "Paikallinen asetus. Aiemmat arviot säilyvät, eikä arviointia vaadita."
            : "Local setting. Existing assessments are preserved; rating is optional."}</p>
        </div>
        {vaultStatus === "unprotected" ? <>
          <h3>{t.protect}</h3><p>{t.vaultWarning}</p>
          <div style={{ display: "grid", gap: "1rem", maxWidth: "360px", marginTop: "1rem" }}>
            <label style={{ display: "grid", gap: "0.4rem" }}>{t.vaultPassword}<input type="password" autoComplete="new-password" value={vaultPassword} onChange={e => setVaultPassword(e.target.value)} /></label>
            <label style={{ display: "grid", gap: "0.4rem" }}>{t.vaultConfirm}<input type="password" autoComplete="new-password" value={vaultConfirm} onChange={e => setVaultConfirm(e.target.value)} /></label>
            <button type="button" disabled={vaultBusy || !birth} onClick={() => { void enableVault(); }}>{t.vaultCreate}</button>
          </div>
        </> : <>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
            <button type="button" disabled={vaultBusy} onClick={() => { void lockVault(); }}>{t.vaultLock}</button>
            <button type="button" className="muted-button settings-action" aria-expanded={passwordSettingsOpen}
              onClick={() => { setPasswordSettingsOpen(!passwordSettingsOpen); setBackupImportOpen(false); setBackupPassword(""); setVaultNew(""); setVaultNewConfirm(""); setPasswordChangeMessage(""); setVaultError(""); setBackupMessage(""); }}>{t.passwordSettings}</button>
            <button type="button" disabled={vaultBusy} onClick={() => { setPasswordSettingsOpen(false); setBackupImportOpen(false); setVaultNew(""); setVaultNewConfirm(""); setBackupPassword(""); setPasswordChangeMessage(""); setVaultError(""); setBackupMessage(""); void exportVault(); }}>{t.vaultEncryptedExport}</button>
            <button type="button" className="muted-button settings-action" disabled={vaultBusy} aria-expanded={backupImportOpen}
              onClick={() => { setBackupImportOpen(!backupImportOpen); setPasswordSettingsOpen(false); setVaultNew(""); setVaultNewConfirm(""); setPasswordChangeMessage(""); setBackupPassword(""); setVaultError(""); setBackupMessage(""); }}>{t.vaultEncryptedImport}</button>
          </div>
          <p className="subtle" style={{ marginTop: "0.65rem", fontSize: "0.85rem" }}>{t.vaultExportHint}</p>
          {backupImportOpen && <div style={{ display: "grid", gap: "0.75rem", maxWidth: "360px", marginTop: "1rem" }}>
            <label style={{ display: "grid", gap: "0.4rem" }}>{t.vaultBackupPassword}<input type="password" autoComplete="off" value={backupPassword} onChange={e => setBackupPassword(e.target.value)} /></label>
            <div className="vault-file-field">
              <span>{t.vaultEncryptedImport}</span>
              <label className="vault-file-picker" aria-disabled={vaultBusy || !backupPassword}>
                <span>{vaultBusy || !backupPassword ? t.vaultChooseFileDisabled : t.vaultChooseFile}</span>
                <input type="file" accept=".json,application/json" disabled={vaultBusy || !backupPassword}
                  aria-label={t.vaultEncryptedImport}
                  onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; void restoreEncryptedVault(file); }} />
              </label>
            </div>
          </div>}
          {passwordSettingsOpen && <div style={{ display: "grid", gap: "0.75rem", maxWidth: "360px", marginTop: "1rem" }}>
            <label style={{ display: "grid", gap: "0.4rem" }}>{t.vaultNew}<input type="password" autoComplete="new-password"
              value={vaultNew} onChange={e => { setVaultNew(e.target.value); setPasswordChangeMessage(""); }} /></label>
            <label style={{ display: "grid", gap: "0.4rem" }}>{t.vaultNewConfirm}<input type="password" autoComplete="new-password"
              value={vaultNewConfirm} onChange={e => { setVaultNewConfirm(e.target.value); setPasswordChangeMessage(""); }} /></label>
            <button type="button" disabled={vaultBusy} onClick={() => { void updatePassword(); }}>{t.vaultChange}</button>
            {passwordChangeMessage && <p role="status">{passwordChangeMessage}</p>}
          </div>}
        </>}
        <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #51627a" }}>
          <h3>{t.dangerZone}</h3>
          <p className="subtle">{t.journalClearConfirm}</p>
          <button type="button" className="muted-button journal-clear-all" disabled={vaultBusy} onClick={() => { void clearJournal(); }}>{t.journalClear}</button>
          <p className="subtle">{t.resetDescription}</p>
          <button type="button" className="muted-button journal-clear-all" disabled={vaultBusy} aria-expanded={resetOpen}
            onClick={() => { setResetOpen(!resetOpen); setResetPassword(""); setResetConfirmation(""); }}>{t.resetAll}</button>
          {resetOpen && <div style={{ display: "grid", gap: "0.75rem", maxWidth: "360px", marginTop: "1rem" }}>
            {vaultStatus === "unlocked" && <label>{t.resetPassword}<input type="password" autoComplete="off" value={resetPassword} onChange={e => setResetPassword(e.target.value)} /></label>}
            <label>{t.resetConfirm}<input type="text" autoComplete="off" value={resetConfirmation} onChange={e => setResetConfirmation(e.target.value)} /></label>
            <button type="button" disabled={vaultBusy || resetConfirmation !== t.resetConfirmWord || (vaultStatus === "unlocked" && !resetPassword)}
              onClick={() => { void resetAll(); }}>{t.resetAll}</button>
          </div>}
        </div>
        {vaultError && <p role="alert">{vaultError}</p>}
        {backupMessage && <p role="status">{backupMessage}</p>}
      </section>}
      <section className="inputs" aria-label="Oracle settings">
        <label>{t.birth}<input type="date" value={birthDraft} min="1800-01-01" max={localToday()} aria-invalid={Boolean(birthInputError)} onChange={(event) => { setBirthDraft(event.target.value); setBirthInputError(""); }} onBlur={commitBirthDraft} />{birthInputError && <span role="alert" style={{ color: "#f5a7a7", fontSize: "0.85rem" }}>{birthInputError}</span>}</label>
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
          <h2>{savedForecast?.message ?? oracleMessage(result.values, persona, lang, day, birth)}</h2>
          <p className="subtle">{t.days}: {result.daysLived.toLocaleString(lang)}</p>
          {savedForecast && <p className="subtle">{lang === "fi" ? "Tallennettu ennuste" : "Saved forecast"} · {new Date(savedForecast.createdAt).toLocaleString(lang)}
            {new Date(savedForecast.createdAt).getHours() >= 18 && <span> · {lang === "fi" ? "Näytetty ensi kertaa illalla" : "First viewed in the evening"}</span>}
          </p>}
          {savedForecast && mayAssess(day, clockNow, assessmentTime) && <div className="panel" style={{ marginTop: "1rem" }}>
            <h3>{lang === "fi" ? "Miltä ennuste tuntui jälkikäteen?" : "How did the forecast feel in hindsight?"}</h3>
            <p className="subtle">{lang === "fi" ? "Oma tulkintasi, ei ennusteen tieteellinen osuvuus." : "Your subjective impression, not scientific predictive accuracy."}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: "0.75rem", alignItems: "start", marginTop: "0.75rem" }}>
              <label style={{ display: "grid", gap: "0.4rem", minWidth: 0 }}>
                {lang === "fi" ? "Arvio" : "Rating"}
                <select style={{ width: "100%", minWidth: 0, height: "42px", boxSizing: "border-box", fontSize: "0.9rem", padding: "0 2.4rem 0 0.75rem", lineHeight: "normal" }} value={assessmentRating} onChange={e => { setAssessmentRating(e.target.value as ForecastRating); setAssessmentFeedback("idle"); }}>
                  <option value="unsure">{lang === "fi" ? "En osaa sanoa" : "Unsure"}</option>
                  <option value="yes">{lang === "fi" ? "Osui" : "Felt accurate"}</option>
                  <option value="partial">{lang === "fi" ? "Osittain" : "Partly"}</option>
                  <option value="no">{lang === "fi" ? "Ei osunut" : "Did not fit"}</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: "0.4rem", minWidth: 0 }}>
                {lang === "fi" ? "Huomio (vapaaehtoinen)" : "Note (optional)"}
                <textarea style={{ width: "100%", minWidth: 0, boxSizing: "border-box", height: "54px", minHeight: "54px", resize: "vertical" }} maxLength={500} value={assessmentNote} onChange={e => { setAssessmentNote(e.target.value); setAssessmentFeedback("idle"); }} />
              </label>
            </div>
            <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <button type="button" disabled={assessmentFeedback === "saving"} onClick={() => { void saveAssessment(); }}>{assessmentFeedback === "saving" ? (lang === "fi" ? "Tallennetaan…" : "Saving…") : (lang === "fi" ? "Tallenna arvio" : "Save assessment")}</button>
              {assessmentFeedback === "saved" && <span role="status" className="subtle">{lang === "fi" ? "✓ Arvio tallennettu" : "✓ Assessment saved"}</span>}
            </div>
            {assessmentError && <p role="alert">{assessmentError}</p>}
          </div>}
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
            {intention && <p className="intention-saved" role="status">{saveLabel ?? `✓ ${t.intentionSaved}`}</p>}
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
            <span role="status">{saveLabel ?? `✓ ${t.eveningSaved}`}</span>
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
            <button type="button" className="muted-button" onClick={() => { void exportJournal("json"); }}>{t.journalExportJson}</button>
            <button type="button" className="muted-button" onClick={() => { void exportJournal("md"); }}>{t.journalExportMd}</button>
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

      </>}
      <footer>{t.disclaimer} · v0.1.0-alpha.1</footer>
    </main>
  );
}
