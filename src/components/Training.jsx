import { useState } from 'react';
import { fmtShort } from '../lib/dates';
import ExerciseIcon from './ExerciseIcon';
import TimerTool from './TimerTool';

const EXERCISES = [
  'Sentadilla', 'Press de banca', 'Peso muerto', 'Press militar', 'Remo con barra',
  'Curl de bíceps', 'Extensión de tríceps', 'Zancadas', 'Jalón al pecho', 'Elevación lateral', 'Otro…'
];

function userName(users, uid) {
  return users.find((u) => u.id === uid)?.name || uid;
}

export default function Training({ users, currentUser, workouts, actions }) {
  const [tab, setTab] = useState('gym');
  const [exercise, setExercise] = useState(EXERCISES[0]);
  const [customExercise, setCustomExercise] = useState('');
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(20);
  const [pendingSets, setPendingSets] = useState([]);
  const [runMin, setRunMin] = useState(30);
  const [runKm, setRunKm] = useState(5);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' o un user id

  const filteredWorkouts = historyFilter === 'all' ? workouts : workouts.filter((w) => w.user_id === historyFilter);
  const gymLogs = filteredWorkouts.filter((w) => w.type === 'strength');
  const runLogs = filteredWorkouts.filter((w) => w.type === 'cardio');

  function addSet() {
    const r = Number(reps);
    if (!r) return;
    setPendingSets((s) => [...s, { reps: r, weight: Number(weight) || 0 }]);
  }
  function removeSet(i) {
    setPendingSets((s) => s.filter((_, idx) => idx !== i));
  }
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

  return (
    <section className="screen active">
      <h2 className="section-title">Entrenamiento</h2>
      <div className="subtabs">
        <button className={tab === 'gym' ? 'active' : ''} onClick={() => setTab('gym')}>🏋️ Gym</button>
        <button className={tab === 'run' ? 'active' : ''} onClick={() => setTab('run')}>🏃 Running</button>
        <button className={tab === 'timer' ? 'active' : ''} onClick={() => setTab('timer')}>⏱ Tiempo</button>
      </div>

      {tab !== 'timer' && (
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
              {EXERCISES.map((ex) => <option key={ex}>{ex}</option>)}
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
              <div className="ldetail">{r.duration_min} minutos · ritmo {(r.duration_min / (r.distance_km || 1)).toFixed(1)} min/km</div>
            </div>
          )) : <div className="empty">Sin registros todavía.</div>}
        </div>
      )}

      {tab === 'timer' && <TimerTool />}
    </section>
  );
}
