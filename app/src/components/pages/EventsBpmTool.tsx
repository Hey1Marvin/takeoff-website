"use client";
/* BPM-Tap-Tempo — reines Client-Feature, vergleicht Tap-Tempo mit den
   Genre-BPM-Ranges aus events.json. Portierung von wireBpmTool() aus
   assets/js/pages/events.js. */
import { useEffect, useRef, useState } from "react";

type Genre = { name: string; bpmMin: number; bpmMax: number };

const IDLE_MS = 2200;
const FALLBACK_GENRES: Genre[] = [
  { name: "Trance", bpmMin: 130, bpmMax: 140 },
  { name: "Hard Trance", bpmMin: 140, bpmMax: 150 },
  { name: "Hard Bounce", bpmMin: 150, bpmMax: 160 },
  { name: "Techno", bpmMin: 125, bpmMax: 135 },
];

function matchGenre(bpm: number, genres: Genre[]): string {
  const hit = genres.find(g => bpm >= g.bpmMin && bpm <= g.bpmMax);
  if (hit) return `Du tickst wie ${hit.name} (${hit.bpmMin}–${hit.bpmMax} BPM)`;
  const mid = (g: Genre) => (g.bpmMin + g.bpmMax) / 2;
  const closest = genres.reduce((a, b) => (Math.abs(mid(a) - bpm) < Math.abs(mid(b) - bpm) ? a : b));
  return bpm < closest.bpmMin
    ? `Ruhiger als ${closest.name} — aber am nächsten dran`
    : `Schneller als jedes Genre hier — Atempause? 😅`;
}

export default function EventsBpmTool({ genres }: { genres?: Genre[] }) {
  const list = genres && genres.length ? genres : FALLBACK_GENRES;
  const [bpm, setBpm] = useState("—");
  const [match, setMatch] = useState("");
  const tapsRef = useRef<number[]>([]);
  const idleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const reset = () => {
    tapsRef.current = [];
    setBpm("—");
    setMatch("");
    clearTimeout(idleRef.current);
  };

  const tap = () => {
    const now = performance.now();
    const taps = tapsRef.current;
    taps.push(now);
    if (taps.length > 6) taps.shift();
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(reset, IDLE_MS);
    if (taps.length < 2) {
      setBpm("…");
      setMatch("");
      return;
    }
    const intervals: number[] = [];
    for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);
    const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const value = Math.round(60000 / avgMs);
    setBpm(String(value));
    setMatch(matchGenre(value, list));
  };

  useEffect(() => () => clearTimeout(idleRef.current), []);

  return (
    <div className="bpmtool">
      <button type="button" className="bpm-pad" aria-label="Hier im Takt tippen — Tap-Tempo-Werkzeug" onClick={tap}>
        <span>Tap</span><small>im Takt</small>
      </button>
      <div className="bpm-readout" aria-live="polite">
        <b>{bpm}</b><span>BPM</span>
      </div>
      <p className="bpm-match" aria-live="polite">{match}</p>
      <button type="button" className="bpm-reset" onClick={reset}>Zurücksetzen</button>
    </div>
  );
}
