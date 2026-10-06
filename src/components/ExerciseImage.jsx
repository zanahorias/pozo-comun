import { useEffect, useRef, useState } from 'react';
import ExerciseIcon from './ExerciseIcon';

// Fotos de ejercicios: base pública "free-exercise-db" (dominio público).
// Orden de prioridad: tu foto propia → foto de la base → ícono de respaldo.
const BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/';
const DB_URL = BASE + 'dist/exercises.json';
const MAP_KEY = 'arriba-eximg-map2';
const PIC_KEY = (uid, name) => `arriba-expic-${uid}-${name}`;

export function iconFor(name) {
  const n = (name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/farmer/.test(n)) return 'Farmer Walk';
  if (/talones/.test(n)) return 'Caminata talones';
  if (/dorsiflex/.test(n)) return 'Dorsiflexión';
  if (/equilibrio/.test(n)) return 'Equilibrio';
  if (/alfabeto/.test(n)) return 'Alfabeto pie';
  if (/zancada|bulgara|patada/.test(n)) return 'Zancadas';
  if (/sentadilla|goblet|hip thrust|puente|salto|pliometria|gemelos|abduccion/.test(n)) return 'Sentadilla';
  if (/press de banca|press de pecho|press inclinado|aperturas/.test(n)) return 'Press de banca';
  if (/militar|press de hombros/.test(n)) return 'Press militar';
  if (/remo|pendlay/.test(n)) return 'Remo con barra';
  if (/curl/.test(n)) return 'Curl de bíceps';
  if (/triceps/.test(n)) return 'Extensión de tríceps';
  if (/elevacion|vuelos|pajaros/.test(n)) return 'Elevación lateral';
  if (/peso muerto|pm |good morning/.test(n)) return 'Peso muerto';
  return 'default';
}

// Tokeniza sin apóstrofes y con plural simple (raises → raise, farmer's → farmer).
const tok = (s) => (s || '').toLowerCase().replace(/'/g, '').split(/[^a-z0-9]+/).filter(Boolean).map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t));

let dbPromise = null;
const loadDb = () => {
  if (!dbPromise) {
    dbPromise = fetch(DB_URL)
      .then((r) => r.json())
      .then((list) => list.map((e) => ({ id: e.id, tokens: new Set(tok(e.name)) })))
      .catch(() => { dbPromise = null; return []; });
  }
  return dbPromise;
};

const readMap = () => { try { return JSON.parse(localStorage.getItem(MAP_KEY) || '{}'); } catch (e) { return {}; } };

async function resolveId(en) {
  if (!en) return null;
  const map = readMap();
  if (map[en] !== undefined) return map[en];
  const db = await loadDb();
  if (!db.length) return null;
  // `en` admite alternativas separadas por | (se prueba en orden).
  let best = null;
  for (const alt of en.split('|')) {
    const q = tok(alt);
    if (!q.length) continue;
    let bestScore = -1;
    db.forEach((e) => {
      if (!q.every((t) => e.tokens.has(t))) return;
      const score = 100 - (e.tokens.size - q.length);
      if (score > bestScore) { bestScore = score; best = e.id; }
    });
    if (best) break;
  }
  map[en] = best;
  try { localStorage.setItem(MAP_KEY, JSON.stringify(map)); } catch (e) { /* ignore */ }
  return best;
}

function resize(file, max = 480) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function ExerciseImage({ name, en, uid, editable = false }) {
  const [id, setId] = useState(null);
  const [frame, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);
  const [custom, setCustom] = useState(() => localStorage.getItem(PIC_KEY(uid, name)));
  const fileRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setFrame(0);
    setCustom(localStorage.getItem(PIC_KEY(uid, name)));
    resolveId(en).then((r) => { if (!cancelled) setId(r); });
    return () => { cancelled = true; };
  }, [en, name, uid]);

  async function pick(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const data = await resize(f);
      localStorage.setItem(PIC_KEY(uid, name), data);
      setCustom(data);
    } catch (err) {
      console.warn(err);
    }
  }

  function clearCustom() {
    localStorage.removeItem(PIC_KEY(uid, name));
    setCustom(null);
  }

  const src = custom || (id && !failed ? `${BASE}exercises/${id}/${frame}.jpg` : null);

  return (
    <div className="ex-photo">
      {src ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          onClick={() => !custom && setFrame((f) => (f ? 0 : 1))}
          onError={() => (frame === 1 ? setFrame(0) : setFailed(true))}
        />
      ) : (
        <div className="ex-photo-fallback"><ExerciseIcon name={iconFor(name)} /></div>
      )}
      {(editable || !src) && (
        <div className="ex-photo-tools">
          <button type="button" onClick={() => fileRef.current?.click()}>📷</button>
          {custom && <button type="button" onClick={clearCustom}>✕</button>}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
        </div>
      )}
    </div>
  );
}
