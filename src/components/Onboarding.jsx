import { useState } from 'react';
import { DOW_LABELS } from '../lib/dates';
import { habitLabel } from '../lib/logic';
import { getCommitment, saveCommitment, trainDaysOf } from '../lib/commitments';
import '../theme-q4.css';

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // lunes → domingo

function DayPicker({ value, onChange }) {
  const toggle = (d) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);
  return (
    <div className="day-picker">
      {ORDER.map((d) => (
        <button key={d} type="button" className={value.includes(d) ? 'sel' : ''} onClick={() => toggle(d)}>
          {DOW_LABELS[d]}
        </button>
      ))}
    </div>
  );
}

// Primera vez (o "Mis compromisos"): cuántos y qué días te comprometés a cada hábito.
export default function Onboarding({ user, habits, onDone, onCancel }) {
  const prev = getCommitment(user.id);
  const gymHabits = habits.filter((h) => h.type === 'gym');
  const others = habits.filter((h) => h.type !== 'gym');
  const [train, setTrain] = useState(trainDaysOf(user.id) || [1, 3, 5]);
  const [days, setDays] = useState(() => {
    const m = {};
    habits.forEach((h) => { m[h.id] = prev?.habitDays?.[h.id] || h.days; });
    return m;
  });

  const trainOk = train.length >= 2 && train.length <= 5;
  const canSave = trainOk && others.every((h) => days[h.id].length > 0);

  async function save() {
    const habitDays = { ...days };
    gymHabits.forEach((h) => { habitDays[h.id] = train; });
    await saveCommitment(user.id, { habitDays, trainDays: train.slice().sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)) });
    onDone();
  }

  return (
    <div className="onboard">
      <h1 className="display" style={{ fontSize: 22 }}>¡Hola {user.name}! 👋</h1>
      <p className="hmeta" style={{ margin: '4px 0 18px' }}>
        Elegí qué días te comprometés a cada hábito. Con eso armamos tu calendario y tus rutinas. Podés cambiarlo cuando quieras desde Hábitos → Mis compromisos.
      </p>

      <div className="log-card">
        <div className="lname">🏋️ Entrenamiento</div>
        <div className="hmeta" style={{ marginBottom: 8 }}>
          {train.length} {train.length === 1 ? 'día' : 'días'} por semana (elegí entre 2 y 5) → define tu rutina.
        </div>
        <DayPicker value={train} onChange={setTrain} />
        {!trainOk && <div className="hmeta" style={{ color: 'var(--coral)', marginTop: 6 }}>Elegí entre 2 y 5 días.</div>}
      </div>

      {others.map((h) => (
        <div className="log-card" key={h.id}>
          <div className="lname">{h.emoji ? h.emoji + ' ' : ''}{habitLabel(h)}</div>
          <div className="hmeta" style={{ marginBottom: 8 }}>{days[h.id].length} días por semana</div>
          <DayPicker value={days[h.id]} onChange={(v) => setDays((s) => ({ ...s, [h.id]: v }))} />
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={!canSave} onClick={save}>Guardar compromisos</button>
        {onCancel && <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>}
      </div>
    </div>
  );
}
