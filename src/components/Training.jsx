import { useCallback, useEffect, useMemo, useState } from 'react';
import { dateKey, fmtShort, today, DOW_LABELS } from '../lib/dates';
import { supabase } from '../lib/supabase';
import { trainDaysOf } from '../lib/commitments';
import ExerciseImage from './ExerciseImage';
import TimerTool from './TimerTool';
import '../theme-q4.css';

// Puntos por entrenar (se guardan como bonus_logs: ex_<ejercicio> y routine_complete).
export const EXERCISE_POINTS = 3;
export const ROUTINE_BONUS = 15;

const x = (name, spec, en = '') => ({ name, spec, en });

const ANKLE_BLOCK = [
  x('Alfabeto con el pie', '2x1'),
  x('Dorsiflexión en pared', '2x15'),
  x('Equilibrio 1 pierna', '3x30s')
];

const ROUTINES = {
  cristi: {
    note: 'Mancuernas + peso corporal · sin banco · cero impacto en rodillas · el cardio va en la pestaña Cardio.',
    pre: [],
    freq: {
      2: [
        { title: 'Full Body 1', ex: [x('Puente de glúteo en suelo', '3x15-20', 'glute bridge'), x('Press de hombros de pie', '3x12-15', 'dumbbell shoulder press'), x('Peso muerto rumano con mancuernas', '3x12-15', 'romanian deadlift|stiff legged dumbbell deadlift'), x('Remo inclinada con mancuernas', '3x12-15', 'bent over dumbbell row'), x('Plancha de antebrazos', '3x30-45s', 'plank')] },
        { title: 'Full Body 2', ex: [x('Puente de glúteo con mancuerna', '3x12-15', 'barbell glute bridge'), x('Press de pecho en suelo', '3x12-15', 'dumbbell floor press'), x('Good Mornings / PM sumo', '3x12-15', 'good morning'), x('Vuelos laterales', '3x15', 'side lateral raise'), x('Deadbug', '3x12/lado', 'dead bug')] }
      ],
      3: [
        { title: 'Full Body A', ex: [x('Puente de glúteo con mancuerna', '4x12-15', 'barbell glute bridge'), x('Remo 1 mano inclinada', '3x12/lado', 'one arm dumbbell row'), x('Peso muerto rumano', '3x15', 'romanian deadlift|stiff legged dumbbell deadlift'), x('Elevaciones laterales', '3x15-20', 'side lateral raise')] },
        { title: 'Full Body B', ex: [x('Press de pecho en suelo', '3x12-15', 'dumbbell floor press'), x('Patada de glúteo en cuadrupedia', '3x15-20', 'glute kickback|donkey kick'), x('Abducción de cadera acostada', '3x15-20', 'side leg raise|hip abduction|abductor'), x('Press militar de pie', '3x12-15', 'dumbbell shoulder press'), x('Pájaros inclinada', '3x15', 'reverse flyes')] },
        { title: 'Full Body C', ex: [x('Puente de glúteo 1 pierna', '3x12/lado', 'single leg glute bridge'), x('Remo abierto con mancuernas', '3x12-15', 'bent over dumbbell row'), x('PM sumo ligero', '3x15', 'good morning'), x('Curl de bíceps + Extensión de tríceps', '3x15', 'dumbbell bicep curl'), x('Plancha lateral', '3x30s/lado', 'side bridge')] }
      ],
      4: [
        { title: 'Torso A', ex: [x('Press de pecho en suelo', '3x12-15', 'dumbbell floor press'), x('Remo inclinada con mancuernas', '3x12-15', 'bent over dumbbell row'), x('Press de hombros de pie', '3x12-15', 'dumbbell shoulder press'), x('Curl de bíceps + Extensión de tríceps', '3x15', 'dumbbell bicep curl'), x('Plancha de antebrazos', '3x30-45s', 'plank')] },
        { title: 'Pierna A (bajo impacto)', ex: [x('Puente de glúteo con mancuerna', '4x12-15', 'barbell glute bridge'), x('Peso muerto rumano con mancuernas', '3x12-15', 'romanian deadlift|stiff legged dumbbell deadlift'), x('Puente de glúteo 1 pierna', '3x12/lado', 'single leg glute bridge'), x('Abducción de cadera acostada', '3x15-20', 'side leg raise|hip abduction|abductor'), x('Gemelos de pie con mancuernas', '3x15-20', 'standing dumbbell calf raise')] },
        { title: 'Torso B', ex: [x('Press de pecho en suelo', '3x12-15', 'dumbbell floor press'), x('Remo 1 mano inclinada', '3x12/lado', 'one arm dumbbell row'), x('Elevaciones laterales', '3x15-20', 'side lateral raise'), x('Pájaros inclinada', '3x15', 'reverse flyes'), x('Deadbug', '3x12/lado', 'dead bug')] },
        { title: 'Pierna B (bajo impacto)', ex: [x('Puente de glúteo en suelo', '3x15-20', 'glute bridge'), x('Good Mornings / PM sumo', '3x12-15', 'good morning'), x('Patada de glúteo en cuadrupedia', '3x15-20', 'glute kickback|donkey kick'), x('Puente de glúteo con mancuerna', '3x12-15', 'barbell glute bridge'), x('Plancha lateral', '3x30s/lado', 'side bridge')] }
      ],
      5: [
        { title: 'Glúteo + Core', ex: [x('Puente de glúteo con mancuerna', '3x12-15', 'barbell glute bridge'), x('Puente de glúteo 1 pierna', '2x12/lado', 'single leg glute bridge'), x('Patada de glúteo en cuadrupedia', '2x15-20', 'glute kickback|donkey kick'), x('Deadbug', '2x12/lado', 'dead bug')] },
        { title: 'Empuje', ex: [x('Press de pecho en suelo', '3x12-15', 'dumbbell floor press'), x('Press de hombros de pie', '3x12-15', 'dumbbell shoulder press'), x('Elevaciones laterales', '2x15-20', 'side lateral raise'), x('Extensión de tríceps', '2x15', 'dumbbell triceps extension')] },
        { title: 'Posterior', ex: [x('Peso muerto rumano con mancuernas', '3x12-15', 'romanian deadlift|stiff legged dumbbell deadlift'), x('Good Mornings / PM sumo', '2x12-15', 'good morning'), x('Abducción de cadera acostada', '2x15-20', 'side leg raise|hip abduction|abductor'), x('Plancha lateral', '2x30s/lado', 'side bridge')] },
        { title: 'Tracción', ex: [x('Remo inclinada con mancuernas', '3x12-15', 'bent over dumbbell row'), x('Remo 1 mano inclinada', '2x12/lado', 'one arm dumbbell row'), x('Pájaros inclinada', '2x15', 'reverse flyes'), x('Curl de bíceps', '2x15', 'dumbbell bicep curl')] },
        { title: 'Full Body suave', ex: [x('Puente de glúteo en suelo', '2x15-20', 'glute bridge'), x('Press de pecho en suelo', '2x12-15', 'dumbbell floor press'), x('Remo abierto con mancuernas', '2x12-15', 'bent over dumbbell row'), x('Plancha de antebrazos', '2x30s', 'plank')] }
      ]
    }
  },
  nico: {
    note: 'Barra, mancuernas y bancos · hipertrofia 12-20 reps · bloque de tobillo antes de cada rutina (fútbol).',
    pre: ANKLE_BLOCK,
    freq: {
      2: [
        { title: 'Full Body + Potencia', ex: [x('Salto vertical desde banco', '3x5', 'box jump'), x('Press de banca con barra', '3x12-15', 'barbell bench press'), x('PM rumano con barra', '3x12-15', 'romanian deadlift'), x('Remo con barra/mancuernas', '3x12-15', 'bent over barbell row'), x('Gemelos 1 pierna con mancuerna', '3x15-20', 'standing dumbbell calf raise')] },
        { title: 'Full Body + Agilidad', ex: [x('Saltos laterales', '3x8/lado', 'lateral bound'), x('Press inclinado con mancuernas', '3x12-15', 'incline dumbbell press'), x('Zancada atrás con mancuernas', '3x12/pierna', 'dumbbell rear lunge'), x('Press militar barra/mancuernas', '3x12-15', 'barbell shoulder press'), x('Farmer Walk', '3x40m', 'farmers walk')] }
      ],
      3: [
        { title: 'Push', ex: [x('Broad Jump / Salto al cajón', '3x5', 'box jump'), x('Press de banca con barra', '4x12-15', 'barbell bench press'), x('Press inclinado con mancuernas', '3x12-15', 'incline dumbbell press'), x('Press militar', '3x12-15', 'barbell shoulder press'), x('Extensión de tríceps', '3x15-20', 'triceps extension')] },
        { title: 'Pull', ex: [x('Remo Pendlay / con barra', '4x12-15', 'bent over barbell row'), x('Remo 1 mano', '3x12-15', 'one arm dumbbell row'), x('Pájaros', '3x15-20', 'reverse flyes'), x('Curl de bíceps', '3x12-15', 'barbell curl'), x('Farmer Walk 1 mano', '3x30s/lado', 'farmers walk')] },
        { title: 'Legs', ex: [x('Pliometría escalera / saltos al frente', '3x6', 'box jump'), x('Sentadilla con barra / Goblet', '4x12-15', 'barbell squat'), x('PM rumano con barra', '3x12-15', 'romanian deadlift'), x('Zancadas búlgaras', '3x12/pierna', 'split squat'), x('Gemelos en banco', '4x15-20', 'standing calf raise')] }
      ],
      4: [
        { title: 'Torso Pesado', ex: [x('Press de banca con barra', '4x10-12', 'barbell bench press'), x('Remo con barra', '4x10-12', 'bent over barbell row'), x('Press militar con barra', '3x12', 'barbell shoulder press'), x('Remo 1 mano', '3x12-15', 'one arm dumbbell row'), x('Extensión de tríceps', '3x15', 'triceps extension')] },
        { title: 'Pierna + Potencia', ex: [x('Salto vertical desde banco', '3x5', 'box jump'), x('Sentadilla con barra', '4x12-15', 'barbell squat'), x('PM rumano con barra', '3x12-15', 'romanian deadlift'), x('Zancada atrás con mancuernas', '3x12/pierna', 'dumbbell rear lunge'), x('Gemelos 1 pierna con mancuerna', '3x15-20', 'standing dumbbell calf raise')] },
        { title: 'Torso Hipertrofia', ex: [x('Press inclinado con mancuernas', '4x12-15', 'incline dumbbell press'), x('Remo con mancuernas', '3x15', 'bent over dumbbell row'), x('Elevaciones laterales', '3x15-20', 'side lateral raise'), x('Curl de bíceps', '3x15', 'dumbbell bicep curl'), x('Extensión de tríceps', '3x15-20', 'triceps extension')] },
        { title: 'Pierna + Agilidad', ex: [x('Saltos laterales', '3x8/lado', 'lateral bound'), x('Zancadas búlgaras', '3x12/pierna', 'split squat'), x('Hip Thrust con barra', '3x12-15', 'barbell hip thrust'), x('Pliometría escalera', '3x6', 'box jump'), x('Gemelos en banco', '4x15-20', 'standing calf raise')] }
      ],
      5: [
        { title: 'Pecho + Salto', ex: [x('Broad Jump', '3x5', 'box jump'), x('Press de banca con barra', '4x12-15', 'barbell bench press'), x('Press inclinado con mancuernas', '3x12-15', 'incline dumbbell press'), x('Aperturas con mancuernas', '3x15', 'dumbbell flyes'), x('Extensión de tríceps', '3x15-20', 'triceps extension')] },
        { title: 'Espalda + Tobillo', ex: [x('Remo Pendlay / con barra', '4x12-15', 'bent over barbell row'), x('Remo 1 mano', '3x12-15', 'one arm dumbbell row'), x('Pájaros', '3x15-20', 'reverse flyes'), x('Curl de bíceps', '3x12-15', 'barbell curl'), x('Gemelos 1 pierna con mancuerna', '3x15-20', 'standing dumbbell calf raise'), x('Caminata en talones', '3x20m', '')] },
        { title: 'Piernas + Pliometría', ex: [x('Pliometría escalera', '3x6', 'box jump'), x('Sentadilla con barra / Goblet', '4x12-15', 'barbell squat'), x('PM rumano con barra', '3x12-15', 'romanian deadlift'), x('Zancadas búlgaras', '3x12/pierna', 'split squat'), x('Gemelos en banco', '4x15-20', 'standing calf raise')] },
        { title: 'Hombros + Core', ex: [x('Press militar con barra', '4x12-15', 'barbell shoulder press'), x('Elevaciones laterales', '4x15-20', 'side lateral raise'), x('Pájaros', '3x15-20', 'reverse flyes'), x('Plancha / Pallof press', '3x40s', 'plank'), x('Farmer Walk', '3x40m', 'farmers walk')] },
        { title: 'Brazos + Transferencia', ex: [x('Curl de bíceps con barra', '3x12-15', 'barbell curl'), x('Extensión de tríceps', '3x12-15', 'triceps extension'), x('Curl martillo', '3x15', 'hammer curl'), x('Saltos laterales', '3x8/lado', 'lateral bound'), x('Farmer Walk 1 mano', '3x30s/lado', 'farmers walk')] }
      ]
    }
  }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);

function profileOf(user) {
  const n = norm(user?.name);
  if (n.includes('cristi')) return 'cristi';
  if (n.includes('nico')) return 'nico';
  return null;
}

function parseSpec(spec) {
  const [sets, rest = '10'] = spec.split('x');
  const n = parseInt(rest, 10) || 10;
  const unit = /\d\s*s(\/|$)/.test(rest) ? 'seg' : /\dm$/.test(rest) ? 'm' : 'reps';
  return { sets: parseInt(sets, 10) || 3, reps: rest, label: rest, n, unit };
}

const userName = (users, uid) => users.find((u) => u.id === uid)?.name || uid;

// Inicio del "día" actual (corte 04:00) como ISO.
const dayStartIso = () => {
  const t = today();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate(), 4, 0, 0).toISOString();
};

// Rutinas editables por usuario (se guardan en este dispositivo).
function useRoutineStore(uid) {
  const key = 'arriba-routine-' + uid;
  const read = () => { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return {}; } };
  const [custom, setCustom] = useState(read);
  useEffect(() => { setCustom(read()); /* eslint-disable-next-line */ }, [uid]);
  const persist = (next) => { setCustom(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch (e) { /* ignore */ } };
  return {
    get: (profile, freq, fallback) => custom[profile + freq] || fallback,
    set: (profile, freq, days) => persist({ ...custom, [profile + freq]: days }),
    reset: (profile, freq) => { const n = { ...custom }; delete n[profile + freq]; persist(n); },
    isCustom: (profile, freq) => !!custom[profile + freq]
  };
}

// Historial de fuerza del usuario: última sesión por ejercicio + todo para los gráficos.
function useHistory(userId, workouts) {
  const [state, setState] = useState({ last: {}, history: [] });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('exercise_name,sets,created_at')
        .eq('user_id', userId)
        .eq('type', 'strength')
        .order('created_at', { ascending: false })
        .limit(800);
      if (error || cancelled) return;
      const last = {};
      (data || []).forEach((w) => {
        if (w.exercise_name && !last[w.exercise_name] && Array.isArray(w.sets) && w.sets.length) last[w.exercise_name] = w.sets;
      });
      setState({ last, history: data || [] });
    })();
    return () => { cancelled = true; };
  }, [userId, workouts]);
  return state;
}

// Ejercicios ya completados en el día en curso.
function useDoneToday(userId) {
  const [done, setDone] = useState({});
  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('workouts')
      .select('exercise_name,sets')
      .eq('user_id', userId)
      .eq('type', 'strength')
      .gte('created_at', dayStartIso());
    const m = {};
    (data || []).forEach((w) => { m[w.exercise_name] = w.sets; });
    setDone(m);
    return m;
  }, [userId]);
  useEffect(() => { refresh(); }, [refresh]);
  return [done, setDone, refresh];
}

// ---------------------------------------------------------------------------
// Tarjeta de ejercicio (se achica al completarlo)
// ---------------------------------------------------------------------------
function RoutineExercise({ ex, uid, lastSets, doneSets, onComplete }) {
  const spec = parseSpec(ex.spec);
  const build = () =>
    Array.from({ length: spec.sets }, (_, i) => {
      const prev = lastSets?.[i] || lastSets?.[lastSets.length - 1];
      return { reps: prev ? prev.reps : spec.n, weight: prev ? prev.weight : 0 };
    });
  const [rows, setRows] = useState(build);
  const [reopened, setReopened] = useState(false);
  const [saving, setSaving] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setRows(build()); }, [lastSets, ex.spec, ex.name]);

  const upd = (i, k, v) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));
  const finished = !!doneSets && !reopened;

  async function complete() {
    const sets = rows.map((r) => ({ reps: Number(r.reps) || 0, weight: Number(r.weight) || 0 })).filter((r) => r.reps > 0);
    if (!sets.length || saving) return;
    setSaving(true);
    await onComplete(ex, sets);
    setSaving(false);
    setReopened(false);
  }

  if (finished) {
    return (
      <div className="ex-collapsed">
        <span className="ex-check">✓</span>
        <div className="ex-collapsed-name">
          {ex.name}
          <small>{doneSets.map((s) => `${s.reps}×${s.weight}kg`).join(' · ')}</small>
        </div>
        <button className="btn btn-ghost btn-small" onClick={() => setReopened(true)}>Ver</button>
      </div>
    );
  }

  return (
    <div className="log-card routine-ex">
      <div className="routine-head">
        <ExerciseImage name={ex.name} en={ex.en} uid={uid} />
        <div style={{ flex: 1 }}>
          <div className="lname">{ex.name}</div>
          <div className="hmeta">Objetivo: {spec.sets} × {spec.label}{lastSets ? ' · cargado de la vez anterior' : ''}</div>
          <div className="hmeta">Tocá la foto para ver el movimiento</div>
        </div>
      </div>
      {rows.map((r, i) => (
        <div className="set-edit" key={i}>
          <span className="idx">S{i + 1}</span>
          <input type="number" min="0" value={r.reps} onChange={(e) => upd(i, 'reps', e.target.value)} aria-label={spec.unit} />
          <span className="u">{spec.unit}</span>
          <input type="number" min="0" step="0.5" value={r.weight} onChange={(e) => upd(i, 'weight', e.target.value)} aria-label="kg" />
          <span className="u">kg</span>
        </div>
      ))}
      <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={saving} onClick={complete}>
        {saving ? 'Guardando…' : `Ejercicio completado  (+${EXERCISE_POINTS} pts)`}
      </button>
    </div>
  );
}

// Edición de un ejercicio de la rutina (nombre, series, reps, orden, foto).
function EditRow({ ex, uid, index, total, onChange, onMove, onRemove }) {
  const spec = parseSpec(ex.spec);
  const set = (patch) => {
    const sets = patch.sets ?? spec.sets;
    const reps = patch.reps ?? spec.reps;
    onChange({ ...ex, ...(patch.name !== undefined ? { name: patch.name } : {}), spec: `${sets}x${reps}` });
  };
  return (
    <div className="log-card edit-ex">
      <div className="routine-head">
        <ExerciseImage name={ex.name} en={ex.en} uid={uid} editable />
        <input className="edit-name" value={ex.name} onChange={(e) => set({ name: e.target.value })} />
      </div>
      <div className="field-row cols-2">
        <div><label className="flabel">Series</label><input type="number" min="1" max="10" value={spec.sets} onChange={(e) => set({ sets: Number(e.target.value) || 1 })} /></div>
        <div><label className="flabel">Reps / tiempo</label><input value={spec.reps} onChange={(e) => set({ reps: e.target.value })} placeholder="12-15, 30s, 8/lado" /></div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-ghost btn-small" disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
        <button className="btn btn-ghost btn-small" disabled={index === total - 1} onClick={() => onMove(1)}>↓</button>
        <button className="btn btn-ghost btn-small" style={{ marginLeft: 'auto', color: 'var(--coral)', borderColor: 'var(--coral)' }} onClick={onRemove}>Quitar</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gráficos de progreso semanal
// ---------------------------------------------------------------------------
function Chart({ data, labels, color, kind, unit }) {
  const W = 320, H = 130, P = { l: 30, r: 10, t: 14, b: 22 };
  const vals = data.filter((v) => v !== null);
  const max = Math.max(1, ...vals);
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const step = iw / data.length;
  const px = (i) => P.l + step * i + step / 2;
  const py = (v) => P.t + ih - (v / max) * ih;
  const pts = data.map((v, i) => (v === null ? null : [px(i), py(v)])).filter(Boolean);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={P.l} x2={W - P.r} y1={P.t + ih - f * ih} y2={P.t + ih - f * ih} stroke="var(--line)" strokeDasharray="3 4" />
          <text x={P.l - 5} y={P.t + ih - f * ih + 3} textAnchor="end" fontSize="9" fill="var(--muted)">{Math.round(max * f)}</text>
        </g>
      ))}
      {kind === 'bar' && data.map((v, i) => v !== null && (
        <rect key={i} x={px(i) - step * 0.28} y={py(v)} width={step * 0.56} height={P.t + ih - py(v)} rx="4" fill={color} />
      ))}
      {kind === 'line' && pts.length > 1 && <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />}
      {kind === 'line' && data.map((v, i) => v !== null && <circle key={i} cx={px(i)} cy={py(v)} r="4" fill={color} />)}
      {data.map((v, i) => v !== null && (
        <text key={'v' + i} x={px(i)} y={py(v) - 7} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--ink)">{Math.round(v * 10) / 10}</text>
      ))}
      {labels.map((l, i) => <text key={'l' + i} x={px(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--muted)">{l}</text>)}
      <text x={W - P.r} y={10} textAnchor="end" fontSize="9" fill="var(--muted)">{unit}</text>
    </svg>
  );
}

function Progress({ history }) {
  const names = useMemo(() => {
    const c = {};
    history.forEach((w) => { c[w.exercise_name] = (c[w.exercise_name] || 0) + 1; });
    return Object.keys(c).sort((a, b) => c[b] - c[a]);
  }, [history]);
  const [sel, setSel] = useState('');
  const name = sel && names.includes(sel) ? sel : names[0];

  if (!names.length) return <div className="empty">Completá ejercicios de tu rutina y acá vas a ver tu avance semanal.</div>;

  const monday = (d) => { const m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; };
  const thisMon = monday(new Date());
  const weeks = Array.from({ length: 8 }, (_, i) => { const d = new Date(thisMon); d.setDate(d.getDate() - 7 * (7 - i)); return d; });
  const agg = weeks.map(() => ({ maxW: null, reps: null }));
  history.filter((w) => w.exercise_name === name).forEach((w) => {
    const m = monday(new Date(w.created_at)).getTime();
    const i = weeks.findIndex((d) => d.getTime() === m);
    if (i < 0) return;
    (w.sets || []).forEach((s) => {
      agg[i].maxW = Math.max(agg[i].maxW ?? 0, s.weight || 0);
      agg[i].reps = (agg[i].reps ?? 0) + (s.reps || 0);
    });
  });
  const labels = weeks.map((d) => `${d.getDate()}/${d.getMonth() + 1}`);
  const w = agg.map((a) => a.maxW);
  const lastTwo = w.filter((v) => v !== null).slice(-2);
  const delta = lastTwo.length === 2 ? lastTwo[1] - lastTwo[0] : null;

  return (
    <div>
      <div className="field-row">
        <label className="flabel">Ejercicio</label>
        <select value={name} onChange={(e) => setSel(e.target.value)}>
          {names.map((n) => <option key={n}>{n}</option>)}
        </select>
      </div>
      {delta !== null && (
        <div className={'progress-chip ' + (delta >= 0 ? 'up' : 'down')}>
          {delta > 0 ? '▲' : delta < 0 ? '▼' : '='} {Math.abs(delta)} kg vs. la semana anterior
        </div>
      )}
      <div className="log-card">
        <div className="lname">Peso máximo por semana</div>
        <Chart data={w} labels={labels} color="var(--court)" kind="line" unit="kg" />
      </div>
      <div className="log-card">
        <div className="lname">Repeticiones totales por semana</div>
        <Chart data={agg.map((a) => a.reps)} labels={labels} color="var(--amber)" kind="bar" unit="reps" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cardio (trote, caminata, bici...)
// ---------------------------------------------------------------------------
const ACTIVITIES = [
  { id: 'Trote', icon: '🏃', pace: true },
  { id: 'Caminata', icon: '🚶', pace: true },
  { id: 'Bici', icon: '🚴', pace: false },
  { id: 'Otro', icon: '⚡', pace: false }
];
const actOf = (w) => ACTIVITIES.find((a) => a.id === w.exercise_name) || ACTIVITIES[0];
const mondayOf = (d) => { const m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; };

function paceText(act, min, km) {
  if (!min || !km) return '';
  return act.pace ? `${(min / km).toFixed(1)} min/km` : `${(km / (min / 60)).toFixed(1)} km/h`;
}

function Cardio({ users, uid, actions, workouts, onSaved }) {
  const [act, setAct] = useState('Trote');
  const [min, setMin] = useState(30);
  const [km, setKm] = useState('');
  const [filter, setFilter] = useState(uid);
  const [logs, setLogs] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('workouts').select('*').eq('type', 'cardio').order('created_at', { ascending: false }).limit(300);
    setLogs(data || []);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load, workouts]);

  const current = ACTIVITIES.find((a) => a.id === act);
  const shown = filter === 'all' ? logs : logs.filter((w) => w.user_id === filter);

  const thisMon = mondayOf(new Date());
  const weeks = Array.from({ length: 8 }, (_, i) => { const d = new Date(thisMon); d.setDate(d.getDate() - 7 * (7 - i)); return d; });
  const kmWeek = weeks.map(() => 0);
  let wkMin = 0, wkKm = 0, wkN = 0;
  shown.forEach((w) => {
    const m = mondayOf(new Date(w.created_at)).getTime();
    const i = weeks.findIndex((d) => d.getTime() === m);
    if (i < 0) return;
    kmWeek[i] += Number(w.distance_km) || 0;
    if (i === 7) { wkMin += Number(w.duration_min) || 0; wkKm += Number(w.distance_km) || 0; wkN += 1; }
  });

  async function save() {
    const m = Number(min) || 0;
    const k = Number(km) || 0;
    if (m <= 0 || saving) return;
    setSaving(true);
    await actions.logRun(uid, m, k, act);
    await load();
    setSaving(false);
    onSaved(`${current.icon} ${act} registrado · ${m} min${k ? ` · ${k} km` : ''}`);
    setKm('');
  }

  return (
    <div>
      <div className="act-grid">
        {ACTIVITIES.map((a) => (
          <button key={a.id} type="button" className={'act-chip' + (act === a.id ? ' sel' : '')} onClick={() => setAct(a.id)}>
            <span className="act-ico">{a.icon}</span>{a.id}
          </button>
        ))}
      </div>
      <div className="field-row cols-2">
        <div><label className="flabel">Tiempo (min)</label><input type="number" min="1" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} /></div>
        <div><label className="flabel">Kilómetros</label><input type="number" min="0" step="0.1" inputMode="decimal" placeholder="0" value={km} onChange={(e) => setKm(e.target.value)} /></div>
      </div>
      {paceText(current, Number(min), Number(km)) && <div className="hmeta" style={{ marginBottom: 8 }}>Ritmo estimado: {paceText(current, Number(min), Number(km))}</div>}
      <button className="btn btn-primary" style={{ width: '100%', marginBottom: 18 }} disabled={saving || !(Number(min) > 0)} onClick={save}>
        {saving ? 'Guardando…' : `Registrar ${act.toLowerCase()}`}
      </button>

      <div className="field-row">
        <label className="flabel">Ver de</label>
        <div className="day-picker">
          {users.map((u) => (
            <button key={u.id} type="button" className={filter === u.id ? 'sel' : ''} onClick={() => setFilter(u.id)}>{u.name}</button>
          ))}
          <button type="button" className={filter === 'all' ? 'sel' : ''} onClick={() => setFilter('all')}>Todos</button>
        </div>
      </div>

      <div className="wallets" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="wallet"><div className="wallet-label">Esta semana</div><div className="wallet-value">{Math.round(wkKm * 10) / 10}<small> km</small></div></div>
        <div className="wallet"><div className="wallet-label">Tiempo</div><div className="wallet-value">{wkMin}<small> min</small></div></div>
        <div className="wallet"><div className="wallet-label">Sesiones</div><div className="wallet-value">{wkN}</div></div>
      </div>

      <div className="log-card">
        <div className="lname">Kilómetros por semana</div>
        <Chart data={kmWeek.map((v) => (v > 0 ? Math.round(v * 10) / 10 : null))} labels={weeks.map((d) => `${d.getDate()}/${d.getMonth() + 1}`)} color="var(--court)" kind="bar" unit="km" />
      </div>

      {shown.length ? shown.slice(0, 40).map((r) => {
        const a = actOf(r);
        return (
          <div className="log-card" key={r.id}>
            <div className="lhead">
              <span className="lname">{a.icon} {a.id}{Number(r.distance_km) ? ` · ${r.distance_km} km` : ''}</span>
              <span className="ldate">{fmtShort(new Date(r.created_at))} · {userName(users, r.user_id)}</span>
            </div>
            <div className="ldetail">{r.duration_min} min{paceText(a, Number(r.duration_min), Number(r.distance_km)) ? ' · ' + paceText(a, Number(r.duration_min), Number(r.distance_km)) : ''}</div>
          </div>
        );
      }) : <div className="empty">Sin registros todavía.</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pantalla
// ---------------------------------------------------------------------------
export default function Training({ users, currentUser, workouts, actions, isAdmin }) {
  const uid = currentUser.id;
  const [tab, setTab] = useState('routine');
  const autoProfile = profileOf(currentUser);
  const [profile, setProfile] = useState(autoProfile || 'nico');
  const myDays = trainDaysOf(uid);
  const committedFreq = myDays ? Math.min(5, Math.max(2, myDays.length)) : null;
  const freqKey = 'training-freq-' + uid;
  const [freq, setFreq] = useState(() => committedFreq || Number(localStorage.getItem(freqKey)) || 3);
  const [dayIdx, setDayIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState('');

  const store = useRoutineStore(uid);
  const { last, history } = useHistory(uid, workouts);
  const [doneToday, setDoneToday, refreshDone] = useDoneToday(uid);

  useEffect(() => { setProfile(autoProfile || 'nico'); }, [uid, autoProfile]);
  useEffect(() => { if (committedFreq) setFreq(committedFreq); }, [committedFreq]);
  useEffect(() => { localStorage.setItem(freqKey, String(freq)); }, [freq, freqKey]);

  const routine = ROUTINES[profile];
  const days = store.get(profile, freq, routine.freq[freq]);
  // Con compromiso: cada día de la rutina se asocia a un día de la semana.
  const weekdayFor = (i) => (myDays && myDays.length === freq ? myDays[i] : null);
  useEffect(() => {
    const dow = today().getDay();
    const i = myDays && myDays.length === freq ? myDays.indexOf(dow) : -1;
    setDayIdx(i >= 0 ? i : 0);
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freq, profile, uid]);
  // Usuarios (no admin) con compromiso: solo ven la rutina del día que les toca.
  const restricted = !isAdmin && !!myDays && myDays.length === freq;
  const todayIdx = myDays ? myDays.indexOf(today().getDay()) : -1;
  const restDay = restricted && todayIdx < 0;
  const shownIdx = restricted ? Math.max(0, todayIdx) : dayIdx;
  const day = days[Math.max(0, Math.min(shownIdx, days.length - 1))];
  const NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const nextTrain = (() => {
    if (!restDay) return null;
    const dow = today().getDay();
    for (let k = 1; k <= 7; k++) {
      const i = myDays.indexOf((dow + k) % 7);
      if (i >= 0) return { name: NAMES[(dow + k) % 7], title: days[i]?.title };
    }
    return null;
  })();

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  async function award(kind, points) {
    const { error } = await supabase
      .from('training_points')
      .upsert([{ user_id: uid, kind, points, log_date: dateKey(today()) }], { onConflict: 'user_id,kind,log_date', ignoreDuplicates: true });
    if (error) { console.warn('training_points', error); return error.message || 'error'; }
    return null;
  }

  async function completeExercise(ex, sets, isPre = false) {
    await actions.logGym(uid, ex.name, sets);
    const err = await award('ex_' + slug(ex.name), EXERCISE_POINTS);
    const nextDone = { ...doneToday, [ex.name]: sets };
    setDoneToday(nextDone);
    let msg = err ? `⚠️ ${ex.name} guardado, pero no sumó puntos: ${err}` : `+${EXERCISE_POINTS} pts · ${ex.name} ✓`;
    if (!isPre && day.ex.every((e) => nextDone[e.name])) {
      const errR = await award('routine_complete', ROUTINE_BONUS);
      msg = errR ? `⚠️ Rutina completa, pero no sumó el bonus: ${errR}` : `🎉 ¡Rutina completa! +${ROUTINE_BONUS} pts de bonus`;
    }
    flash(msg);
    refreshDone();
  }

  // --- edición de rutina ---
  const saveDay = (ex) => store.set(profile, freq, days.map((d, i) => (i === shownIdx ? { ...d, ex } : d)));
  const changeEx = (i, v) => saveDay(day.ex.map((e, k) => (k === i ? v : e)));
  const moveEx = (i, dir) => { const a = day.ex.slice(); [a[i], a[i + dir]] = [a[i + dir], a[i]]; saveDay(a); };
  const removeEx = (i) => saveDay(day.ex.filter((_, k) => k !== i));
  const addEx = () => saveDay([...day.ex, x('Nuevo ejercicio', '3x12', '')]);

  const doneCount = day.ex.filter((e) => doneToday[e.name]).length;

  return (
    <section className="screen active">
      <h2 className="section-title">Entrenamiento</h2>
      <div className="subtabs">
        <button className={tab === 'routine' ? 'active' : ''} onClick={() => setTab('routine')}>📋 Rutina</button>
        <button className={tab === 'progress' ? 'active' : ''} onClick={() => setTab('progress')}>📈 Progreso</button>
        <button className={tab === 'cardio' ? 'active' : ''} onClick={() => setTab('cardio')}>❤️ Cardio</button>
        <button className={tab === 'timer' ? 'active' : ''} onClick={() => setTab('timer')}>⏱</button>
      </div>
      {toast && <div className="toast-pts">{toast}</div>}

      {tab === 'routine' && (
        <div>
          {!autoProfile && (
            <div className="field-row">
              <label className="flabel">Perfil</label>
              <div className="day-picker">
                <button type="button" className={profile === 'nico' ? 'sel' : ''} onClick={() => setProfile('nico')}>Nico</button>
                <button type="button" className={profile === 'cristi' ? 'sel' : ''} onClick={() => setProfile('cristi')}>Cristi</button>
              </div>
            </div>
          )}
          <div className="hmeta" style={{ marginBottom: 10 }}>{routine.note}</div>

          {!restricted && (
            <>
              <label className="flabel">Frecuencia semanal (admin)</label>
              <div className="day-picker" style={{ marginBottom: 12 }}>
                {[2, 3, 4, 5].map((f) => (
                  <button key={f} type="button" className={freq === f ? 'sel' : ''} onClick={() => setFreq(f)}>{f} días</button>
                ))}
              </div>
              <div className="day-picker" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
                {days.map((d, i) => (
                  <button key={i} type="button" className={dayIdx === i ? 'sel' : ''} onClick={() => { setDayIdx(i); setEditing(false); }}>
                    {weekdayFor(i) !== null ? DOW_LABELS[weekdayFor(i)] : i + 1}
                  </button>
                ))}
              </div>
            </>
          )}
          {restricted && !restDay && <div className="flabel">Hoy · {NAMES[today().getDay()]}</div>}

          {restDay ? (
            <div className="log-card rest-card">
              <div className="lname">😴 Hoy descansás</div>
              <div className="hmeta" style={{ marginTop: 4 }}>
                {nextTrain ? `Próximo entrenamiento: ${nextTrain.name}${nextTrain.title ? ' · ' + nextTrain.title : ''}.` : 'No tenés días de entrenamiento elegidos.'}
              </div>
              <div className="hmeta" style={{ marginTop: 4 }}>Podés sumar cardio desde la pestaña Cardio.</div>
            </div>
          ) : (
          <>

          <div className="routine-title-row">
            <h3 className="shop-sub" style={{ margin: 0 }}>{day.title}</h3>
            <span className="progress-pill">{doneCount}/{day.ex.length}</span>
            <button className="btn btn-ghost btn-small" onClick={() => setEditing((e) => !e)}>{editing ? 'Listo' : '✏️ Editar'}</button>
          </div>
          <div className="bar-track" style={{ margin: '8px 0 14px' }}>
            <div className="bar-fill" style={{ width: `${(doneCount / Math.max(1, day.ex.length)) * 100}%` }} />
          </div>
          <div className="hmeta" style={{ marginBottom: 10 }}>+{EXERCISE_POINTS} pts por ejercicio · +{ROUTINE_BONUS} pts extra al completar toda la rutina.</div>

          {editing ? (
            <>
              {day.ex.map((ex, i) => (
                <EditRow key={i} ex={ex} uid={uid} index={i} total={day.ex.length}
                  onChange={(v) => changeEx(i, v)} onMove={(d) => moveEx(i, d)} onRemove={() => removeEx(i)} />
              ))}
              <button className="btn btn-ghost" style={{ width: '100%', marginBottom: 8 }} onClick={addEx}>+ Agregar ejercicio</button>
              {store.isCustom(profile, freq) && (
                <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--coral)', borderColor: 'var(--coral)' }}
                  onClick={() => window.confirm('¿Volver a la rutina original de ' + freq + ' días?') && store.reset(profile, freq)}>
                  Restaurar rutina original
                </button>
              )}
              <div className="hmeta" style={{ marginTop: 8 }}>Tus cambios se guardan en este dispositivo.</div>
            </>
          ) : (
            <>
              {routine.pre.length > 0 && (
                <>
                  <div className="flabel" style={{ marginTop: 6 }}>🦶 Bloque fijo de tobillo (pre-rutina)</div>
                  {routine.pre.map((ex) => (
                    <RoutineExercise key={'pre-' + ex.name} ex={ex} uid={uid} lastSets={last[ex.name]} doneSets={doneToday[ex.name]}
                      onComplete={(e, s) => completeExercise(e, s, true)} />
                  ))}
                  <div className="flabel" style={{ marginTop: 14 }}>Rutina</div>
                </>
              )}
              {day.ex.map((ex) => (
                <RoutineExercise key={day.title + ex.name} ex={ex} uid={uid} lastSets={last[ex.name]} doneSets={doneToday[ex.name]}
                  onComplete={(e, s) => completeExercise(e, s, false)} />
              ))}
            </>
          )}
          </>
          )}
        </div>
      )}

      {tab === 'progress' && <Progress history={history} />}

      {tab === 'cardio' && <Cardio users={users} uid={uid} actions={actions} workouts={workouts} onSaved={flash} />}

      {tab === 'timer' && <TimerTool />}
    </section>
  );
}
