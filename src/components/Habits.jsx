import { useState } from 'react';
import { CAL_DOW_LABELS, DOW_LABELS, dateKey, mondayOfWeek, today } from '../lib/dates';
import { habitDayStatus } from '../lib/logic';

function WeekStrip({ habit, currentUser, habitLogs, trackingStartDate }) {
  const monday = mondayOfWeek(today());
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    cells.push({ d, s: habitDayStatus(habit, d, currentUser.id, habitLogs, trackingStartDate) });
  }
  return (
    <div className="week-strip">
      {cells.map((c, i) => (
        <div className={'week-dot ' + c.s} key={i}>{CAL_DOW_LABELS[i]}</div>
      ))}
    </div>
  );
}

function HabitAdminForm({ onAdd }) {
  const [kind, setKind] = useState('boolean');
  const [name, setName] = useState('');
  const [points, setPoints] = useState(5);
  const [type, setType] = useState('custom');
  const [unit, setUnit] = useState('');
  const [target, setTarget] = useState(8);
  const [step, setStep] = useState(1);
  const [days, setDays] = useState([1, 2, 3, 4, 5]);

  function toggleDay(i) {
    setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));
  }

  function submit() {
    if (!name.trim() || !days.length) return;
    const habit = {
      name: name.trim(),
      points: Number(points) || 1,
      days,
      type,
      kind
    };
    if (kind === 'quantity') {
      habit.unit = unit.trim() || 'unidades';
      habit.target = Number(target) || 1;
      habit.step = Number(step) || 1;
    }
    onAdd(habit);
    setName('');
  }

  return (
    <div className="admin-panel">
      <label className="flabel">Nuevo hábito</label>
      <div className="kind-toggle">
        <button type="button" className={kind === 'boolean' ? 'sel' : ''} onClick={() => setKind('boolean')}>Sí / No</button>
        <button type="button" className={kind === 'quantity' ? 'sel' : ''} onClick={() => setKind('quantity')}>Por cantidad</button>
      </div>
      <div className="field-row">
        <input placeholder="Nombre, ej: Estirar antes de dormir" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field-row cols-2">
        <input type="number" min="1" placeholder="Puntos (al 100%)" value={points} onChange={(e) => setPoints(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="custom">General</option>
          <option value="gym">Vincular con Gym</option>
          <option value="run">Vincular con Running</option>
        </select>
      </div>
      {kind === 'quantity' && (
        <div className="field-row cols-3">
          <div><label className="flabel">Unidad</label><input placeholder="vasos, min…" value={unit} onChange={(e) => setUnit(e.target.value)} /></div>
          <div><label className="flabel">Meta/día</label><input type="number" min="1" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
          <div><label className="flabel">Paso</label><input type="number" min="1" value={step} onChange={(e) => setStep(e.target.value)} /></div>
        </div>
      )}
      <label className="flabel">Días de la semana</label>
      <div className="day-picker">
        {DOW_LABELS.map((l, i) => (
          <button key={i} type="button" className={days.includes(i) ? 'sel' : ''} onClick={() => toggleDay(i)}>{l}</button>
        ))}
      </div>
      <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={submit}>Crear hábito</button>
    </div>
  );
}

export default function Habits({ habits, habitLogs, currentUser, isAdmin, actions, trackingStartDate }) {
  const t = today();

  return (
    <section className="screen active">
      <h2 className="section-title">Hábitos de la semana</h2>
      {habits.map((h) => {
        const scheduledToday = h.days.includes(t.getDay());
        const dayLabels = h.days.length === 7 ? 'Todos los días' : h.days.slice().sort().map((d) => DOW_LABELS[d]).join(' ');

        if (h.kind === 'quantity') {
          const key = dateKey(t);
          const entry = habitLogs.find((e) => e.habit_id === h.id && e.user_id === currentUser.id && e.log_date === key);
          const amount = entry?.amount || 0;
          const pct = Math.min(100, Math.round((amount / h.target) * 100));
          return (
            <div className="habit-card" key={h.id}>
              <div className="habit-row">
                <div className="check disabled" />
                <div className="habit-info">
                  <div className="hname">{h.name}</div>
                  <div className="hmeta">{dayLabels} · meta {h.target} {h.unit}/día</div>
                </div>
                <div className="habit-pts">hasta +{h.points}</div>
                {isAdmin && (
                  <button className="rm" onClick={() => window.confirm(`¿Eliminar "${h.name}"?`) && actions.deleteHabit(h.id)}>✕</button>
                )}
              </div>
              <div className="qty-block">
                <div className="qty-bar-row"><span><b>{amount}</b> / {h.target} {h.unit}</span><span>{pct}%</span></div>
                <div className="bar-track"><div className="bar-fill" style={{ width: pct + '%' }} /></div>
                {scheduledToday ? (
                  <QtyControls habit={h} onAdd={(delta) => actions.addQuantity(h, currentUser.id, delta)} />
                ) : (
                  <div className="hmeta" style={{ marginTop: 6 }}>No corresponde hoy</div>
                )}
              </div>
              <WeekStrip habit={h} currentUser={currentUser} habitLogs={habitLogs} trackingStartDate={trackingStartDate} />
            </div>
          );
        }

        const status = scheduledToday ? habitDayStatus(h, t, currentUser.id, habitLogs, trackingStartDate) : 'none';
        const done = status === 'done';
        return (
          <div className="habit-card" key={h.id}>
            <div className="habit-row">
              <div
                className={'check ' + (done ? 'done ' : '') + (scheduledToday ? '' : 'disabled')}
                onClick={() => scheduledToday && actions.toggleHabitToday(h, currentUser.id)}
              >
                {done ? '✓' : ''}
              </div>
              <div className="habit-info">
                <div className="hname">{h.name}</div>
                <div className="hmeta">{dayLabels}{scheduledToday ? '' : ' · no corresponde hoy'}</div>
              </div>
              <div className="habit-pts">+{h.points}</div>
              {isAdmin && (
                <button className="rm" onClick={() => window.confirm(`¿Eliminar "${h.name}"?`) && actions.deleteHabit(h.id)}>✕</button>
              )}
            </div>
            <WeekStrip habit={h} currentUser={currentUser} habitLogs={habitLogs} trackingStartDate={trackingStartDate} />
          </div>
        );
      })}

      {isAdmin ? (
        <HabitAdminForm onAdd={actions.addHabit} />
      ) : (
        <div className="locked-note">Solo el admin puede crear hábitos y asignarles puntos.</div>
      )}
    </section>
  );
}

function QtyControls({ habit, onAdd }) {
  const [val, setVal] = useState(habit.step);
  return (
    <div className="qty-controls" style={{ marginTop: 8 }}>
      <button className="qty-btn" onClick={() => onAdd(-Number(val) || -habit.step)}>−</button>
      <input type="number" min="1" value={val} onChange={(e) => setVal(e.target.value)} />
      <button className="qty-btn plus" onClick={() => onAdd(Number(val) || habit.step)}>+ Sumar</button>
    </div>
  );
}
