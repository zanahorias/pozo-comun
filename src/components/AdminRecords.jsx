import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { dateKey, today } from '../lib/dates';
import { habitValue, EXTRA_SESSION_FACTOR } from '../lib/economy';
import '../theme-q4.css';

const BONUS_LABELS = { perfect_day: 'Día perfecto', streak3: 'Racha de 3 días', streak7: 'Racha de 7 días' };

// Ventana de "un día" para los entrenamientos: el día arranca a las 4:00 (igual que en el resto de la app).
function dayWindow(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return [new Date(y, m - 1, d, 4, 0, 0).toISOString(), new Date(y, m - 1, d + 1, 4, 0, 0).toISOString()];
}

// Panel de administración: ver los registros de un usuario en una fecha, borrar los mal
// registrados y agregar los que faltan. Sumar/restar puntos es automático: los puntos
// viven en cada registro, así que borrar quita lo que sumó y agregar suma lo que corresponde.
export default function AdminRecords({ users, habits, defaultUserId, actions }) {
  const [open, setOpen] = useState(false);
  const [uid, setUid] = useState(defaultUserId);
  const [date, setDate] = useState(dateKey(today()));
  const [rows, setRows] = useState({ habit: [], training: [], bonus: [], workout: [] });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // formulario "agregar"
  const [addKind, setAddKind] = useState('habit'); // habit | extra | cardio | adjust
  const [habitId, setHabitId] = useState('');
  const [amount, setAmount] = useState('');
  const [minutes, setMinutes] = useState('30');
  const [km, setKm] = useState('');
  const [activity, setActivity] = useState('Trote');
  const [markHabit, setMarkHabit] = useState(true);
  const [adjPoints, setAdjPoints] = useState('');
  const [adjNote, setAdjNote] = useState('');

  const habitById = (id) => habits.find((h) => h.id === id);
  const addableHabits = habits;

  useEffect(() => {
    if (!habitId && habits.length) setHabitId(habits[0].id);
  }, [habits, habitId]);

  const load = useCallback(async () => {
    if (!uid || !date) return;
    const [w0, w1] = dayWindow(date);
    const [h, t, b, w] = await Promise.all([
      supabase.from('habit_logs').select('*').eq('user_id', uid).eq('log_date', date),
      supabase.from('training_points').select('*').eq('user_id', uid).eq('log_date', date),
      supabase.from('bonus_logs').select('*').eq('user_id', uid).eq('log_date', date),
      supabase.from('workouts').select('*').eq('user_id', uid).gte('created_at', w0).lt('created_at', w1).order('created_at', { ascending: true })
    ]);
    setRows({ habit: h.data || [], training: t.data || [], bonus: b.data || [], workout: w.data || [] });
  }, [uid, date]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const total =
    rows.habit.reduce((s, r) => s + (r.points || 0), 0) +
    rows.training.reduce((s, r) => s + (r.points || 0), 0) +
    rows.bonus.reduce((s, r) => s + (r.points || 0), 0);

  async function finish(res, okText) {
    setBusy(false);
    if (res && res.ok === false) setMsg('⚠️ ' + res.error);
    else setMsg(okText);
    await load();
    if (actions.refresh) await actions.refresh();
  }

  async function del(kind, row, label) {
    if (!window.confirm(`¿Borrar "${label}"? Se quitan sus puntos.`)) return;
    setBusy(true);
    finish(await actions.adminDeleteRecord(kind, row), 'Registro borrado ✓');
  }

  const selHabit = habitById(habitId);
  const previewPts = (() => {
    if (!selHabit) return 0;
    const base = habitValue(selHabit, uid, new Date(date + 'T00:00:00'), habits);
    if (addKind === 'extra') return Math.max(1, Math.round(base * EXTRA_SESSION_FACTOR));
    if (selHabit.kind === 'quantity') {
      const a = Number(amount) > 0 ? Number(amount) : selHabit.target;
      return Math.round(base * Math.min(1, a / selHabit.target));
    }
    return base;
  })();

  async function add() {
    if (busy) return;
    setBusy(true);
    if (addKind === 'habit' || addKind === 'extra') {
      if (!selHabit) { setBusy(false); return; }
      const res = await actions.adminAddHabitLog(selHabit, uid, date, { amount, extra: addKind === 'extra' });
      finish(res, res.ok ? `Agregado ✓ (+${res.points} pts)` : '');
    } else if (addKind === 'cardio') {
      const res = await actions.adminAddCardio(uid, date, minutes, km, activity, markHabit);
      finish(res, res.ok ? `Cardio agregado ✓${res.points ? ` (+${res.points} pts del hábito)` : ''}` : '');
    } else {
      const n = Number(adjPoints);
      if (!n) { setBusy(false); setMsg('Poné un número distinto de 0 (puede ser negativo).'); return; }
      const res = await actions.adminAdjustPoints(uid, date, n, adjNote);
      finish(res, res.ok ? `Ajuste aplicado ✓ (${n > 0 ? '+' : ''}${n} pts)` : '');
    }
  }

  const userName = (id) => users.find((u) => u.id === id)?.name || '';

  function describeTraining(r) {
    if (r.kind.startsWith('extra_')) return `Sesión extra: ${habitById(r.kind.slice(6))?.name || 'hábito'}`;
    if (r.kind.startsWith('ex_')) return `Ejercicio: ${r.kind.slice(3).replace(/-/g, ' ')}`;
    if (r.kind === 'routine_done') return 'Marca de rutina completa';
    if (r.kind.startsWith('adj_')) {
      const note = r.kind.split('_').slice(2).join(' ').replace(/-/g, ' ');
      return `Ajuste manual${note ? ': ' + note : ''}`;
    }
    return r.kind;
  }

  return (
    <div className="admin-panel">
      <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setOpen(!open)}>
        🛠 Registros (admin) {open ? '▲' : '▼'}
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          <div className="field-row cols-2">
            <div>
              <label className="flabel">Usuario</label>
              <select value={uid} onChange={(e) => setUid(e.target.value)}>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="flabel">Fecha</label>
              <input type="date" value={date} max={dateKey(today())} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </div>
          </div>

          <div className="flabel" style={{ marginTop: 6 }}>Registros de {userName(uid)} · {date}</div>

          {rows.habit.map((r) => {
            const h = habitById(r.habit_id);
            const label = `${h?.name || 'Hábito'}${r.amount != null ? ` · ${r.amount}${h?.unit ? ' ' + h.unit : ''}` : ''}${r.points < 0 ? ' (no cumplido)' : ''}`;
            return (
              <div className="set-row" key={'h' + r.id}>
                <span className="spec">✅ {label}</span>
                <b style={{ color: r.points < 0 ? 'var(--coral)' : undefined }}>{r.points > 0 ? '+' : ''}{r.points}</b>
                <button className="rm" disabled={busy} onClick={() => del('habit', r, label)} aria-label="Borrar">✕</button>
              </div>
            );
          })}
          {rows.training.map((r) => (
            <div className="set-row" key={'t' + r.id}>
              <span className="spec">🏋️ {describeTraining(r)}</span>
              <b style={{ color: r.points < 0 ? 'var(--coral)' : undefined }}>{r.points > 0 ? '+' : ''}{r.points}</b>
              <button className="rm" disabled={busy} onClick={() => del('training', r, describeTraining(r))} aria-label="Borrar">✕</button>
            </div>
          ))}
          {rows.bonus.map((r) => (
            <div className="set-row" key={'b' + r.id}>
              <span className="spec">🎁 {BONUS_LABELS[r.kind] || r.kind}</span>
              <b>+{r.points}</b>
              <button className="rm" disabled={busy} onClick={() => del('bonus', r, BONUS_LABELS[r.kind] || r.kind)} aria-label="Borrar">✕</button>
            </div>
          ))}
          {rows.workout.map((r) => {
            const label = r.type === 'cardio'
              ? `${r.exercise_name} · ${r.duration_min || 0} min${r.distance_km ? ` · ${r.distance_km} km` : ''}`
              : r.exercise_name;
            return (
              <div className="set-row" key={'w' + r.id}>
                <span className="spec">{r.type === 'cardio' ? '🏃' : '💪'} {label}</span>
                <b style={{ opacity: 0.5 }}>—</b>
                <button className="rm" disabled={busy} onClick={() => del('workout', r, label)} aria-label="Borrar">✕</button>
              </div>
            );
          })}
          {!rows.habit.length && !rows.training.length && !rows.bonus.length && !rows.workout.length && (
            <div className="hmeta" style={{ padding: '8px 2px' }}>Sin registros ese día.</div>
          )}
          <div className="hmeta" style={{ marginTop: 6 }}>
            Total de puntos del día: <b>{total > 0 ? '+' : ''}{total}</b>. Los entrenamientos (🏃 💪) no suman por sí solos: los puntos están en el hábito y en los ejercicios.
          </div>

          <div className="flabel" style={{ marginTop: 16 }}>Agregar registro</div>
          <div className="kind-toggle">
            <button className={addKind === 'habit' ? 'sel' : ''} onClick={() => setAddKind('habit')}>Hábito</button>
            <button className={addKind === 'extra' ? 'sel' : ''} onClick={() => setAddKind('extra')}>Extra</button>
            <button className={addKind === 'cardio' ? 'sel' : ''} onClick={() => setAddKind('cardio')}>Cardio</button>
            <button className={addKind === 'adjust' ? 'sel' : ''} onClick={() => setAddKind('adjust')}>Ajuste</button>
          </div>

          {(addKind === 'habit' || addKind === 'extra') && (
            <>
              <div className="field-row">
                <select value={habitId} onChange={(e) => setHabitId(e.target.value)}>
                  {addableHabits.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              {addKind === 'habit' && selHabit?.kind === 'quantity' && (
                <div className="field-row">
                  <input type="number" min="0" placeholder={`Cantidad (meta ${selHabit.target}${selHabit.unit ? ' ' + selHabit.unit : ''})`} value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
              )}
              <div className="hmeta" style={{ marginBottom: 8 }}>
                {addKind === 'extra' ? 'Sesión extra' : 'Cumplido'}: suma <b>+{previewPts} pts</b>
                {addKind === 'habit' ? '. Si ese día estaba como no cumplido, lo reemplaza.' : '.'}
              </div>
            </>
          )}

          {addKind === 'cardio' && (
            <>
              <div className="field-row cols-3">
                <select value={activity} onChange={(e) => setActivity(e.target.value)}>
                  {['Trote', 'Caminata', 'Bici', 'Otro'].map((a) => <option key={a}>{a}</option>)}
                </select>
                <input type="number" min="0" placeholder="Min" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
                <input type="number" min="0" step="0.1" placeholder="Km" value={km} onChange={(e) => setKm(e.target.value)} />
              </div>
              <label className="hmeta" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={markHabit} onChange={(e) => setMarkHabit(e.target.checked)} />
                Marcar también el hábito de cardio ese día (suma sus puntos)
              </label>
            </>
          )}

          {addKind === 'adjust' && (
            <div className="field-row cols-2">
              <input type="number" placeholder="Puntos (+ o −)" value={adjPoints} onChange={(e) => setAdjPoints(e.target.value)} />
              <input placeholder="Motivo (opcional)" value={adjNote} onChange={(e) => setAdjNote(e.target.value)} />
            </div>
          )}

          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy} onClick={add}>
            {busy ? 'Guardando…' : 'Agregar'}
          </button>
          {msg && <div className="hmeta" style={{ marginTop: 8 }}>{msg}</div>}
        </div>
      )}
    </div>
  );
}
