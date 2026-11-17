import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";


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
    timeline: "Your cosmic curves",
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
    timeline: "Kosmiset käyräsi",
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
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={lang === "fi" ? "Biorytmikäyrä. Valitse päivä napsauttamalla." : "Biorhythm chart. Click to select a date."} className="chart">
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
  const [birth, setBirth] = useState(() => localStorage.getItem("dayoracle-birth") ?? "");
  const [day, setDay] = useState(localToday);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [intention, setIntention] = useState("");
  const t = text[lang];

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
  const forget = () => { setBirth(""); setResult(null); setIntention(""); };
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
        {birth && <button className="muted-button" onClick={forget}>{t.forget}</button>}
      </section>

      {!birth && <section className="panel empty"><h2>{t.noBirth}</h2><p>{t.disclaimer}</p></section>}
      {error && <section className="panel error" role="alert">{error}</section>}
      {result && !error && <>
        <section className="hero panel">
          <div className="eyebrow">✦ {t.perspective}</div>
          <h2>{oracleMessage(result.values, persona, lang, day, birth)}</h2>
          <p className="subtle">{t.days}: {result.daysLived.toLocaleString(lang)}</p>
        </section>
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
        <section className="bottom-grid">
          <div className="panel">
            <div className="eyebrow">✧ {t.quote}</div>
            <p className="quote">“{quote}”</p>
            <small>— DayOracle</small>
          </div>
          <div className="panel">
            <div className="eyebrow">☀ {t.intention}</div>
            <div className="intentions">
              {(["curious","kind","pause"] as const).map((key) =>
                <button type="button" className={intention===key?"intent active":"intent"} key={key}
                  onClick={() => setIntention(key)} aria-pressed={intention===key}>{t[key]}</button>)}
            </div>
          </div>
        </section>
      </>}
      <footer>{t.disclaimer} · v0.1.0-alpha.1</footer>
    </main>
  );
}
