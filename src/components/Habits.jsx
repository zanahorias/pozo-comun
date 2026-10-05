import { useState } from 'react';
import { CAL_DOW_LABELS, DOW_LABELS, dateKey, mondayOfWeek, today } from '../lib/dates';
import { habitDayStatus, findRecoverableMiss } from '../lib/logic';

const DEFAULT_NEW_POINTS = 5;

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

function HabitCreateForm({ onAdd, isAdmin }) {
  const [kind, setKind] = useState('boolean');
  const [name, setName] = useState('');
  const [points, setPoints] = useState(5);
  const [type, setType] = useState('custom');
  const [shared, setShared] = useState(false);
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
      points: isAdmin ? Number(points) || 1 : DEFAULT_NEW_POINTS,
      days,
      type,
      kind,
      shared
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
        {isAdmin ? (
          <input type="number" min="1" placeholder="Puntos (al 100%)" value={points} onChange={(e) => setPoints(e.target.value)} />
        ) : (
          <div className="hmeta" style={{ alignSelf: 'center' }}>Puntos: los define el admin después</div>
        )}
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
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13 }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={shared} onChange={(e) => setShared(e.target.checked)} />
        Hábito compartido (activa x2 por 24hs si lo cumplen los dos el mismo día)
      </label>
      <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={submit}>Crear hábito</button>
    </div>
  );
}

function HabitEditForm({ habit, isAdmin, onSave, onCancel }) {
  const [name, setName] = useState(habit.name);
  const [type, setType] = useState(habit.type);
  const [shared, setShared] = useState(!!habit.shared);
  const [points, setPoints] = useState(habit.points);
  const [unit, setUnit] = useState(habit.unit || '');
  const [target, setTarget] = useState(habit.target || 1);
  const [step, setStep] = useState(habit.step || 1);
  const [days, setDays] = useState(habit.days);

  function toggleDay(i) {
    setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));
  }

  function save() {
    if (!name.trim() || !days.length) return;
    const patch = { name: name.trim(), type, days, shared };
    if (isAdmin) patch.points = Number(points) || habit.points;
    if (habit.kind === 'quantity') {
      patch.unit = unit.trim() || habit.unit;
      patch.target = Number(target) || habit.target;
      patch.step = Number(step) || habit.step;
    }
    onSave(patch);
  }

  return (
    <div className="admin-panel">
      <div className="field-row"><input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field-row cols-2">
        {isAdmin ? (
          <input type="number" min="1" value={points} onChange={(e) => setPoints(e.target.value)} />
        ) : (
          <div className="hmeta" style={{ alignSelf: 'center' }}>Puntos: {habit.points} (solo admin)</div>
        )}
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="custom">General</option>
          <option value="gym">Vincular con Gym</option>
          <option value="run">Vincular con Running</option>
        </select>
      </div>
      {habit.kind === 'quantity' && (
        <div className="field-row cols-3">
          <div><label className="flabel">Unidad</label><input value={unit} onChange={(e) => setUnit(e.target.value)} /></div>
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
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13 }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={shared} onChange={(e) => setShared(e.target.checked)} />
        Hábito compartido
      </label>
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>Guardar</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

export default function Habits({ habits, habitLogs, currentUser, isAdmin, actions, trackingStartDate }) {
  const t = today();
  const [editingId, setEditingId] = useState(null);

  return (
    <section className="screen active">
      <h2 className="section-title">Hábitos de la semana</h2>
      {habits.map((h) => {
        if (editingId === h.id) {
          return (
            <HabitEditForm
              key={h.id}
              habit={h}
              isAdmin={isAdmin}
              onCancel={() => setEditingId(null)}
              onSave={(patch) => {
                actions.updateHabit(h.id, patch);
                setEditingId(null);
              }}
            />
          );
        }

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
                  <div className="hname">{h.name}{h.shared ? ' 🤝' : ''}</div>
                  <div className="hmeta">{dayLabels} · meta {h.target} {h.unit}/día</div>
                </div>
                <div className="habit-pts">hasta +{h.points}</div>
                <button className="rm" style={{ color: 'var(--court-light)' }} onClick={() => setEditingId(h.id)}>✎</button>
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
        const recoverable = findRecoverableMiss(h, currentUser.id, habitLogs, trackingStartDate);
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
                <div className="hname">{h.name}{h.shared ? ' 🤝' : ''}</div>
                <div className="hmeta">{dayLabels}{scheduledToday ? '' : ' · no corresponde hoy'}</div>
              </div>
              <div className="habit-pts">+{h.points}</div>
              <button className="rm" style={{ color: 'var(--court-light)' }} onClick={() => setEditingId(h.id)}>✎</button>
              {isAdmin && (
                <button className="rm" onClick={() => window.confirm(`¿Eliminar "${h.name}"?`) && actions.deleteHabit(h.id)}>✕</button>
              )}
            </div>
            {recoverable && (
              <div className="recover-row">
                <span>Tenés un día perdido esta semana en "{h.name}".</span>
                <button className="btn btn-ghost btn-small" onClick={() => actions.recoverHabitDay(recoverable, h)}>Recuperar con hoy</button>
              </div>
            )}
            <WeekStrip habit={h} currentUser={currentUser} habitLogs={habitLogs} trackingStartDate={trackingStartDate} />
          </div>
        );
      })}

      <HabitCreateForm onAdd={actions.addHabit} isAdmin={isAdmin} />

      {isAdmin && (
        <div className="admin-panel" style={{ borderColor: 'var(--coral)' }}>
          <label className="flabel" style={{ color: 'var(--coral)' }}>Zona de peligro</label>
          <div className="hmeta" style={{ marginBottom: 10 }}>
            Borra todo el historial de hábitos, bonos y canjes, y arranca el conteo de nuevo desde hoy. No se puede deshacer.
          </div>
          <button
            className="btn btn-ghost"
            style={{ width: '100%', borderColor: 'var(--coral)', color: 'var(--coral)' }}
            onClick={() => {
              if (window.confirm('¿Reiniciar TODO el progreso (calendario, puntos y canjes)? Esta acción no se puede deshacer.')) {
                actions.resetAllProgress();
              }
            }}
          >
            Reiniciar calendario y puntos a cero
          </button>
        </div>
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
