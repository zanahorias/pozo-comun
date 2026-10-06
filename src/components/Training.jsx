import { useEffect, useMemo, useState } from 'react';
import { fmtShort } from '../lib/dates';
import { supabase } from '../lib/supabase';
import ExerciseIcon from './ExerciseIcon';
import TimerTool from './TimerTool';
import '../theme-q4.css';

// ---------------------------------------------------------------------------
// BASE DE RUTINAS
// ---------------------------------------------------------------------------
const x = (name, spec) => ({ name, spec });

const ANKLE_BLOCK = [
  x('Alfabeto con el pie', '2x1'),
  x('Dorsiflexión en pared', '2x15'),
  x('Equilibrio 1 pierna', '3x30s')
];

const ROUTINES = {
  cristi: {
    note: 'Mancuernas + peso corporal · cero impacto en rodillas · cerrá con 15-20 min de cardio suave.',
    cardio: true,
    pre: [],
    freq: {
      2: [
        { title: 'Día 1 · Full Body 1', ex: [x('Puente de glúteo en suelo', '3x15-20'), x('Press de hombros sentada', '3x12-15'), x('Peso muerto rumano con mancuernas', '3x12-15'), x('Remo apoyada en banco', '3x12-15'), x('Plancha de antebrazos', '3x30-45s')] },
        { title: 'Día 2 · Full Body 2', ex: [x('Hip Thrust en banco', '3x12-15'), x('Press de pecho suelo/banco', '3x12-15'), x('Good Mornings / PM sumo', '3x12-15'), x('Vuelos laterales / Remo al mentón', '3x15'), x('Deadbug', '3x12/lado')] }
      ],
      3: [
        { title: 'Día 1 · Full Body A', ex: [x('Hip Thrust', '4x12-15'), x('Remo 1 mano en banco', '3x12/lado'), x('Peso muerto rumano', '3x15'), x('Elevaciones laterales', '3x15-20')] },
        { title: 'Día 2 · Full Body B', ex: [x('Press inclinado/plano', '3x12-15'), x('Abducción de cadera / Patada de glúteo', '3x15-20'), x('Press militar sentada', '3x12-15'), x('Pájaros (deltoides posterior)', '3x15')] },
        { title: 'Día 3 · Full Body C', ex: [x('Puente de glúteo 1 pierna', '3x12/lado'), x('Remo abierto', '3x12-15'), x('PM sumo ligero', '3x15'), x('Curl de bíceps + Extensión de tríceps', '3x15'), x('Pallof press / Plancha lateral', '3x30s/lado')] }
      ],
      4: [
        { title: 'Torso A', ex: [x('Press de pecho en banco', '3x12-15'), x('Remo apoyada en banco', '3x12-15'), x('Press de hombros sentada', '3x12-15'), x('Curl de bíceps + Extensión de tríceps', '3x15'), x('Plancha de antebrazos', '3x30-45s')] },
        { title: 'Pierna A (bajo impacto)', ex: [x('Hip Thrust en banco', '4x12-15'), x('Peso muerto rumano con mancuernas', '3x12-15'), x('Puente de glúteo 1 pierna', '3x12/lado'), x('Abducción de cadera', '3x15-20'), x('Gemelos de pie con mancuernas', '3x15-20')] },
        { title: 'Torso B', ex: [x('Press inclinado', '3x12-15'), x('Remo 1 mano en banco', '3x12/lado'), x('Elevaciones laterales', '3x15-20'), x('Pájaros (deltoides posterior)', '3x15'), x('Deadbug', '3x12/lado')] },
        { title: 'Pierna B (bajo impacto)', ex: [x('Puente de glúteo en suelo', '3x15-20'), x('Good Mornings / PM sumo', '3x12-15'), x('Patada de glúteo', '3x15-20'), x('Hip Thrust en banco', '3x12-15'), x('Plancha lateral', '3x30s/lado')] }
      ],
      5: [
        { title: 'Día 1 · Glúteo + Core', ex: [x('Hip Thrust en banco', '3x12-15'), x('Puente de glúteo 1 pierna', '2x12/lado'), x('Patada de glúteo', '2x15-20'), x('Deadbug', '2x12/lado')] },
        { title: 'Día 2 · Empuje', ex: [x('Press de pecho en banco', '3x12-15'), x('Press de hombros sentada', '3x12-15'), x('Elevaciones laterales', '2x15-20'), x('Extensión de tríceps', '2x15')] },
        { title: 'Día 3 · Posterior', ex: [x('Peso muerto rumano con mancuernas', '3x12-15'), x('Good Mornings / PM sumo', '2x12-15'), x('Abducción de cadera', '2x15-20'), x('Plancha lateral', '2x30s/lado')] },
        { title: 'Día 4 · Tracción', ex: [x('Remo apoyada en banco', '3x12-15'), x('Remo 1 mano en banco', '2x12/lado'), x('Pájaros (deltoides posterior)', '2x15'), x('Curl de bíceps', '2x15')] },
        { title: 'Día 5 · Full Body suave', ex: [x('Puente de glúteo en suelo', '2x15-20'), x('Press inclinado', '2x12-15'), x('Remo abierto', '2x12-15'), x('Pallof press', '2x30s/lado')] }
      ]
    }
  },
  nico: {
    note: 'Barra, mancuernas y bancos · hipertrofia 12-20 reps · bloque de tobillo antes de cada rutina (fútbol).',
    cardio: false,
    pre: ANKLE_BLOCK,
    freq: {
      2: [
        { title: 'Día 1 · Full Body + Potencia', ex: [x('Salto vertical desde banco', '3x5'), x('Press de banca con barra', '3x12-15'), x('PM rumano con barra', '3x12-15'), x('Remo con barra/mancuernas', '3x12-15'), x('Gemelos 1 pierna con mancuerna', '3x15-20')] },
        { title: 'Día 2 · Full Body + Agilidad', ex: [x('Saltos laterales', '3x8/lado'), x('Press inclinado con mancuernas', '3x12-15'), x('Zancada atrás con mancuernas', '3x12/pierna'), x('Press militar barra/mancuernas', '3x12-15'), x('Farmer Walk', '3x40m')] }
      ],
      3: [
        { title: 'Push', ex: [x('Broad Jump / Salto al cajón', '3x5'), x('Press de banca con barra', '4x12-15'), x('Press inclinado con mancuernas', '3x12-15'), x('Press militar', '3x12-15'), x('Extensión de tríceps', '3x15-20')] },
        { title: 'Pull', ex: [x('Remo Pendlay / con barra', '4x12-15'), x('Remo 1 mano', '3x12-15'), x('Pájaros', '3x15-20'), x('Curl de bíceps', '3x12-15'), x('Farmer Walk 1 mano', '3x30s/lado')] },
        { title: 'Legs', ex: [x('Pliometría escalera / saltos al frente', '3x6'), x('Sentadilla con barra / Goblet', '4x12-15'), x('PM rumano con barra', '3x12-15'), x('Zancadas búlgaras', '3x12/pierna'), x('Gemelos en banco', '4x15-20')] }
      ],
      4: [
        { title: 'Torso Pesado', ex: [x('Press de banca con barra', '4x10-12'), x('Remo con barra', '4x10-12'), x('Press militar con barra', '3x12'), x('Remo 1 mano', '3x12-15'), x('Extensión de tríceps', '3x15')] },
        { title: 'Pierna + Potencia', ex: [x('Salto vertical desde banco', '3x5'), x('Sentadilla con barra', '4x12-15'), x('PM rumano con barra', '3x12-15'), x('Zancada atrás con mancuernas', '3x12/pierna'), x('Gemelos 1 pierna con mancuerna', '3x15-20')] },
        { title: 'Torso Hipertrofia', ex: [x('Press inclinado con mancuernas', '4x12-15'), x('Remo con mancuernas', '3x15'), x('Elevaciones laterales', '3x15-20'), x('Curl de bíceps', '3x15'), x('Extensión de tríceps', '3x15-20')] },
        { title: 'Pierna + Agilidad', ex: [x('Saltos laterales', '3x8/lado'), x('Zancadas búlgaras', '3x12/pierna'), x('Hip Thrust con barra', '3x12-15'), x('Pliometría escalera', '3x6'), x('Gemelos en banco', '4x15-20')] }
      ],
      5: [
        { title: 'Pecho + Salto', ex: [x('Broad Jump', '3x5'), x('Press de banca con barra', '4x12-15'), x('Press inclinado con mancuernas', '3x12-15'), x('Aperturas con mancuernas', '3x15'), x('Extensión de tríceps', '3x15-20')] },
        { title: 'Espalda + Tobillo', ex: [x('Remo Pendlay / con barra', '4x12-15'), x('Remo 1 mano', '3x12-15'), x('Pájaros', '3x15-20'), x('Curl de bíceps', '3x12-15'), x('Gemelos 1 pierna con mancuerna', '3x15-20'), x('Caminata en talones', '3x20m')] },
        { title: 'Piernas + Pliometría', ex: [x('Pliometría escalera', '3x6'), x('Sentadilla con barra / Goblet', '4x12-15'), x('PM rumano con barra', '3x12-15'), x('Zancadas búlgaras', '3x12/pierna'), x('Gemelos en banco', '4x15-20')] },
        { title: 'Hombros + Core', ex: [x('Press militar con barra', '4x12-15'), x('Elevaciones laterales', '4x15-20'), x('Pájaros', '3x15-20'), x('Plancha / Pallof press', '3x40s'), x('Farmer Walk', '3x40m')] },
        { title: 'Brazos + Transferencia', ex: [x('Curl de bíceps con barra', '3x12-15'), x('Extensión de tríceps', '3x12-15'), x('Curl martillo', '3x15'), x('Saltos laterales', '3x8/lado'), x('Farmer Walk 1 mano', '3x30s/lado')] }
      ]
    }
  }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function profileOf(user) {
  const n = norm(user?.name);
  if (n.includes('cristi')) return 'cristi';
  if (n.includes('nico')) return 'nico';
  return null;
}

function parseSpec(spec) {
  const [sets, rest] = spec.split('x');
  const n = parseInt(rest, 10) || 10;
  const unit = /\d\s*s(\/|$)/.test(rest) ? 'seg' : /\dm$/.test(rest) ? 'm' : 'reps';
  return { sets: parseInt(sets, 10) || 3, label: rest, n, unit };
}

function iconFor(name) {
  const n = norm(name);
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

function userName(users, uid) {
  return users.find((u) => u.id === uid)?.name || uid;
}

// Última sesión por ejercicio del usuario: { [exercise_name]: sets[] }
function useLastSessions(userId, workouts) {
  const [last, setLast] = useState({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('exercise_name,sets,created_at')
        .eq('user_id', userId)
        .eq('type', 'strength')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error || cancelled) return;
      const map = {};
      (data || []).forEach((w) => {
        if (w.exercise_name && !map[w.exercise_name] && Array.isArray(w.sets) && w.sets.length) map[w.exercise_name] = w.sets;
      });
      setLast(map);
    })();
    return () => { cancelled = true; };
  }, [userId, workouts]);
  return last;
}

// ---------------------------------------------------------------------------
// Tarjeta de ejercicio de la rutina
// ---------------------------------------------------------------------------
function RoutineExercise({ ex, lastSets, onSave }) {
  const spec = parseSpec(ex.spec);
  const build = () =>
    Array.from({ length: spec.sets }, (_, i) => {
      const prev = lastSets?.[i] || lastSets?.[lastSets.length - 1];
      return { reps: prev ? prev.reps : spec.n, weight: prev ? prev.weight : 0 };
    });
  const [rows, setRows] = useState(build);
  const [saved, setSaved] = useState(false);

  // Cuando llega la sesión anterior, precargar peso/reps.
  useEffect(() => { setRows(build()); setSaved(false); /* eslint-disable-next-line */ }, [lastSets, ex.name]);

  const upd = (i, k, v) => { setSaved(false); setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: v } : row))); };

  async function save() {
    const sets = rows.map((r) => ({ reps: Number(r.reps) || 0, weight: Number(r.weight) || 0 })).filter((r) => r.reps > 0);
    if (!sets.length) return;
    await onSave(ex.name, sets);
    setSaved(true);
  }

  return (
    <div className={'log-card routine-ex' + (saved ? ' is-saved' : '')}>
      <div className="routine-head">
        <ExerciseIcon name={iconFor(ex.name)} />
        <div style={{ flex: 1 }}>
          <div className="lname">{ex.name}</div>
          <div className="hmeta">Objetivo: {spec.sets} × {spec.label}{lastSets ? ' · cargado de la sesión anterior' : ''}</div>
        </div>
        {saved && <span className="status-tag st-done">Completado</span>}
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
      <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={save}>Guardar ejercicio</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pantalla
// ---------------------------------------------------------------------------
const FREE_EXERCISES = [
  'Sentadilla', 'Press de banca', 'Peso muerto', 'Press militar', 'Remo con barra',
  'Curl de bíceps', 'Extensión de tríceps', 'Zancadas', 'Jalón al pecho', 'Elevación lateral', 'Otro…'
];

export default function Training({ users, currentUser, workouts, actions }) {
  const [tab, setTab] = useState('routine');
  const autoProfile = profileOf(currentUser);
  const [profile, setProfile] = useState(autoProfile || 'nico');
  const freqKey = 'training-freq-' + currentUser.id;
  const [freq, setFreq] = useState(() => Number(localStorage.getItem(freqKey)) || 3);
  const [dayIdx, setDayIdx] = useState(0);
  const [cardioMin, setCardioMin] = useState(15);
  const [cardioDone, setCardioDone] = useState(false);

  const [exercise, setExercise] = useState(FREE_EXERCISES[0]);
  const [customExercise, setCustomExercise] = useState('');
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(20);
  const [pendingSets, setPendingSets] = useState([]);
  const [runMin, setRunMin] = useState(30);
  const [runKm, setRunKm] = useState(5);
  const [historyFilter, setHistoryFilter] = useState('all');

  useEffect(() => { setProfile(autoProfile || 'nico'); setDayIdx(0); }, [currentUser.id, autoProfile]);
  useEffect(() => { localStorage.setItem(freqKey, String(freq)); }, [freq, freqKey]);

  const lastSessions = useLastSessions(currentUser.id, workouts);
  const routine = ROUTINES[profile];
  const days = useMemo(() => routine.freq[freq], [routine, freq]);
  const day = days[Math.min(dayIdx, days.length - 1)];

  // En modo libre, precargar reps/peso de la sesión anterior del ejercicio elegido.
  useEffect(() => {
    const prev = lastSessions[exercise];
    if (prev?.length) {
      const l = prev[prev.length - 1];
      setReps(l.reps);
      setWeight(l.weight);
    }
  }, [exercise, lastSessions]);

  const filteredWorkouts = historyFilter === 'all' ? workouts : workouts.filter((w) => w.user_id === historyFilter);
  const gymLogs = filteredWorkouts.filter((w) => w.type === 'strength');
  const runLogs = filteredWorkouts.filter((w) => w.type === 'cardio');

  const addSet = () => { const r = Number(reps); if (r) setPendingSets((s) => [...s, { reps: r, weight: Number(weight) || 0 }]); };
  const removeSet = (i) => setPendingSets((s) => s.filter((_, idx) => idx !== i));
  async function saveGym() {
    const name = exercise === 'Otro…' ? customExercise.trim() : exercise;
    if (!name || !pendingSets.length) return;
    await actions.logGym(currentUser.id, name, pendingSets);
    setPendingSets([]);
    setCustomExercise('');
  }
  async function saveRun() {
    if (!Number(runMin) && !Number(runKm)) return;
    await actions.logRun(currentUser.id, Number(runMin), Number(runKm));
  }
  async function saveCardio() {
    if (!Number(cardioMin)) return;
    await actions.logRun(currentUser.id, Number(cardioMin), 0);
    setCardioDone(true);
  }

  return (
    <section className="screen active">
      <h2 className="section-title">Entrenamiento</h2>
      <div className="subtabs">
        <button className={tab === 'routine' ? 'active' : ''} onClick={() => setTab('routine')}>📋 Rutina</button>
        <button className={tab === 'gym' ? 'active' : ''} onClick={() => setTab('gym')}>🏋️ Libre</button>
        <button className={tab === 'run' ? 'active' : ''} onClick={() => setTab('run')}>🏃 Running</button>
        <button className={tab === 'timer' ? 'active' : ''} onClick={() => setTab('timer')}>⏱</button>
      </div>

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

          <label className="flabel">Frecuencia semanal</label>
          <div className="day-picker" style={{ marginBottom: 12 }}>
            {[2, 3, 4, 5].map((f) => (
              <button key={f} type="button" className={freq === f ? 'sel' : ''} onClick={() => { setFreq(f); setDayIdx(0); }}>{f} días</button>
            ))}
          </div>

          <div className="day-picker" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
            {days.map((d, i) => (
              <button key={i} type="button" className={dayIdx === i ? 'sel' : ''} onClick={() => setDayIdx(i)}>{i + 1}</button>
            ))}
          </div>
          <h3 className="shop-sub" style={{ marginTop: 0 }}>{day.title}</h3>

          {routine.pre.length > 0 && (
            <>
              <div className="flabel" style={{ marginTop: 6 }}>🦶 Bloque fijo de tobillo (pre-rutina)</div>
              {routine.pre.map((ex) => (
                <RoutineExercise key={'pre-' + ex.name} ex={ex} lastSets={lastSessions[ex.name]} onSave={(n, s) => actions.logGym(currentUser.id, n, s)} />
              ))}
              <div className="flabel" style={{ marginTop: 14 }}>Rutina</div>
            </>
          )}

          {day.ex.map((ex) => (
            <RoutineExercise key={day.title + ex.name} ex={ex} lastSets={lastSessions[ex.name]} onSave={(n, s) => actions.logGym(currentUser.id, n, s)} />
          ))}

          {routine.cardio && (
            <div className="log-card">
              <div className="lname">🚶 Cardio suave final (15-20 min)</div>
              <div className="hmeta">Bici, caminata inclinada o elíptica. Sin impacto.</div>
              <div className="field-row cols-2" style={{ marginTop: 8 }}>
                <input type="number" min="1" value={cardioMin} onChange={(e) => setCardioMin(e.target.value)} />
                <button className="btn btn-primary" onClick={saveCardio}>{cardioDone ? 'Completado ✓' : 'Registrar cardio'}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {(tab === 'gym' || tab === 'run') && (
        <div className="field-row">
          <label className="flabel">Ver historial de</label>
          <div className="day-picker">
            <button type="button" className={historyFilter === 'all' ? 'sel' : ''} onClick={() => setHistoryFilter('all')}>Todos</button>
            {users.map((u) => (
              <button key={u.id} type="button" className={historyFilter === u.id ? 'sel' : ''} onClick={() => setHistoryFilter(u.id)}>{u.name}</button>
            ))}
          </div>
        </div>
      )}

      {tab === 'gym' && (
        <div>
          <div className="field-row">
            <label className="flabel">Ejercicio</label>
            <select value={exercise} onChange={(e) => setExercise(e.target.value)}>
              {FREE_EXERCISES.map((ex) => <option key={ex}>{ex}</option>)}
            </select>
          </div>
          {exercise !== 'Otro…' && <ExerciseIcon name={exercise} />}
          {exercise === 'Otro…' && (
            <div className="field-row">
              <input placeholder="Nombre del ejercicio" value={customExercise} onChange={(e) => setCustomExercise(e.target.value)} />
            </div>
          )}
          <div className="field-row cols-2">
            <div><label className="flabel">Reps</label><input type="number" min="1" value={reps} onChange={(e) => setReps(e.target.value)} /></div>
            <div><label className="flabel">Peso (kg)</label><input type="number" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
          </div>
          {lastSessions[exercise] && <div className="hmeta" style={{ marginBottom: 8 }}>Sesión anterior: {lastSessions[exercise].map((s) => `${s.reps}×${s.weight}kg`).join(' · ')}</div>}
          <button className="btn btn-ghost" style={{ width: '100%', marginBottom: 10 }} onClick={addSet}>+ Agregar serie</button>

          {pendingSets.length ? (
            pendingSets.map((s, i) => (
              <div className="set-row" key={i}>
                <span className="idx">S{i + 1}</span>
                <span className="spec">{s.reps} reps × {s.weight} kg</span>
                <button className="rm" onClick={() => removeSet(i)}>✕</button>
              </div>
            ))
          ) : (
            <div className="empty" style={{ padding: '10px 0' }}>Agregá al menos una serie.</div>
          )}
          <button className="btn btn-primary" style={{ width: '100%', margin: '6px 0 18px' }} onClick={saveGym}>Guardar ejercicio</button>

          {gymLogs.length ? gymLogs.map((g) => (
            <div className="log-card" key={g.id}>
              <div className="lhead"><span className="lname">{g.exercise_name}</span><span className="ldate">{fmtShort(new Date(g.created_at))} · {userName(users, g.user_id)}</span></div>
              <div className="ldetail">
                {(g.sets || []).map((s, i) => <span className="setline" key={i}>Serie {i + 1}: {s.reps} reps × {s.weight} kg</span>)}
              </div>
            </div>
          )) : <div className="empty">Sin registros todavía.</div>}
        </div>
      )}

      {tab === 'run' && (
        <div>
          <div className="field-row cols-2">
            <div><label className="flabel">Duración (min)</label><input type="number" min="1" value={runMin} onChange={(e) => setRunMin(e.target.value)} /></div>
            <div><label className="flabel">Distancia (km)</label><input type="number" min="0" step="0.1" value={runKm} onChange={(e) => setRunKm(e.target.value)} /></div>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: 16 }} onClick={saveRun}>Registrar carrera</button>
          {runLogs.length ? runLogs.map((r) => (
            <div className="log-card" key={r.id}>
              <div className="lhead"><span className="lname">{r.distance_km} km</span><span className="ldate">{fmtShort(new Date(r.created_at))} · {userName(users, r.user_id)}</span></div>
              <div className="ldetail">{r.duration_min} minutos{r.distance_km ? ` · ritmo ${(r.duration_min / r.distance_km).toFixed(1)} min/km` : ''}</div>
            </div>
          )) : <div className="empty">Sin registros todavía.</div>}
        </div>
      )}

      {tab === 'timer' && <TimerTool />}
    </section>
  );
}
