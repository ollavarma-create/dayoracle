# DayOracle

*A little wonder. A little wisdom. Absolutely no scientific prophecy.*

DayOracle is an offline-first, cross-platform desktop experiment in playful biorhythms, philosophy, and daily intentions. It uses **Rust + Tauri 2 + React + TypeScript**.

> **Entertainment, not science:** Traditional 23/28/33-day biorhythms are not scientifically established predictors of mood, health, intelligence, or future events. DayOracle is not a medical, diagnostic, or crisis-support tool.

## Initial alpha scope

- Classic physical (23-day), emotional (28-day), and intellectual (33-day) curves, calculated in Rust
- 21-day chart and date navigation
- Two intentionally different voices: **Mystic** and **Skeptic**
- Original short philosophical thoughts, in English and Finnish
- Optional daily intention selector
- No accounts, AI API calls, telemetry, or network dependency during app use

The date of birth and language are stored in the local WebView storage. **Forget birth date** deletes the saved date. No daily intention or feedback history is persisted yet.

## Prerequisites

- Rust via rustup (rustc 1.77.2 or newer)
- Node.js 22 or newer and npm
- Tauri 2 Linux development libraries: `webkit2gtk4.1-devel`, `openssl-devel`, `libappindicator-gtk3-devel`, `librsvg2-devel`, `libxdo-devel` and a C toolchain

On Fedora, see the [official Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

## Run on Fedora

```bash
git clone https://github.com/ollavarma-create/dayoracle.git
cd dayoracle
npm install
npm run tauri dev
```

The initial Rust/WebKitGTK compilation can take some time. To run the JavaScript build checks and Rust unit tests independently:

```bash
npm run build
cd src-tauri
cargo test
cargo clippy --all-targets -- -D warnings
```

Desktop bundles can later be built with `npm run tauri build`. Packaging for each platform requires testing on that platform.

## Architecture

- `src-tauri/src/biorhythm.rs`: pure biorhythm calculations, input validation, and Rust unit tests
- `src-tauri/src/lib.rs`: Tauri command boundary
- `src/App.tsx`: initial UI, daily persona messages, and bilingual microcopy
- `src/styles.css`: dark, cosmic presentation

Calendar-date differences are computed using `chrono::NaiveDate`, avoiding local daylight-saving-time changes affecting the number of days lived.

## Roadmap

1. Validate the Tauri app on Fedora 45 and refine the UI.
2. Add the structured, deterministic interpretation engine and zodiac signs.
3. Add user-controlled local feedback storage with clear privacy controls.
4. Introduce **optional** LLM adapters (OpenRouter, OpenAI, local models), keeping all numeric calculations deterministic.

Contributions and testing reports are welcome. The project is licensed under MIT.
