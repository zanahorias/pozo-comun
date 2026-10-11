import { useCallback, useEffect, useRef, useState } from 'react';
import { CAL_DOW_LABELS, DOW_LABELS, WEEK_ORDER, dateKey, mondayOfWeek, today } from '../lib/dates';
import {
  habitDayStatus, findRecoverableMiss, findJokerTarget, parseReward,
  incompleteToday, nextReminder, habitLabel, findAdvanceTarget, jokerState
} from '../lib/logic';
import { supabase } from '../lib/supabase';
import { habitDays, isScheduled, moveHabitDay, getCommitment, saveCommitment, pendingRecovery } from '../lib/commitments';
import { habitValue, EXTRA_SESSION_FACTOR } from '../lib/economy';
import '../theme-q4.css';

const DEFAULT_NEW_POINTS = 5;

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const STATUS_LABEL = { done: 'Completado', pending: 'Pendiente', partial: 'En progreso', missed: 'Perdido' };

function StatusTag({ status }) {
  if (!STATUS_LABEL[status]) return null;
  return <span className={'status-tag st-' + status}>{STATUS_LABEL[status]}</span>;
}

// Recordatorios locales a las 20:00 y 23:00 si quedan hábitos sin cumplir antes
// del corte de las 04:00. Funcionan mientras la app/PWA esté abierta o en segundo
// plano (las notificaciones locales no pueden dispararse con la app cerrada).
export function useHabitReminders(habits, habitLogs, userId, trackingStartDate) {
  const ref = useRef({});
  ref.current = { habits, habitLogs, userId, trackingStartDate };

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return undefined;
    if (Notification.permission === 'default') Notification.requestPermission();
    let timer;

    async function notify(title, body) {
      try {
        const reg = navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : null;
        if (reg) reg.showNotification(title, { body, tag: 'habit-reminder' });
        else new Notification(title, { body, tag: 'habit-reminder' });
      } catch (e) {
        console.warn(e);
      }
    }

    function schedule() {
      const next = nextReminder();
      if (!next) return;
      timer = setTimeout(() => {
        const { habits: hs, habitLogs: ls, userId: uid, trackingStartDate: tsd } = ref.current;
        const storeKey = 'habit-reminder-' + uid + '-' + next.key;
        if (Notification.permission === 'granted' && !localStorage.getItem(storeKey)) {
          const left = incompleteToday(hs || [], uid, ls || [], tsd);
          if (left.length) {
            localStorage.setItem(storeKey, '1');
            notify(
              next.hour === 23 ? '⏰ Última llamada' : 'Hábitos pendientes',
              `Te faltan ${left.length}: ${left.slice(0, 3).map((h) => habitLabel(h)).join(', ')}${left.length > 3 ? '…' : ''}. El día cierra a las 04:00.`
            );
          }
        }
        schedule();
      }, Math.max(1000, next.at.getTime() - Date.now()));
    }
    schedule();
    return () => clearTimeout(timer);
  }, [userId]);
}

// Comodines disponibles = canjeados − usados (redemption_uses). Cuando se usa uno,
// desaparece de "Mis comodines" en la tienda.
function useJokerBalance(userId, deps) {
  const [state, setState] = useState({ available: 0, nextToUse: null });
  const refresh = useCallback(async () => {
    const [rw, rd, us, zero] = await Promise.all([
      supabase.from('rewards').select('id,name,description'),
      supabase.from('redemptions').select('id,reward_id,redeemed_by,created_at').eq('redeemed_by', userId),
      supabase.from('redemption_uses').select('redemption_id'),
      supabase.from('habit_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('points', 0)
    ]);
    if (rw.error || rd.error || zero.error) return;
    setState(jokerState(rw.data || [], rd.data || [], us.error ? [] : us.data || [], userId, zero.count || 0));
  }, [userId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refresh(); }, [refresh, ...deps]);
  return [state.available, refresh, state.nextToUse];
}

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
        <div className={'week-dot ' + c.s} key={i}><span>{CAL_DOW_LABELS[i]}</span></div>
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
          <input type="number" min="1" placeholder="Peso (relativo, ej: 5 / 10)" value={points} onChange={(e) => setPoints(e.target.value)} />
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
        {WEEK_ORDER.map((i) => (
          <button key={i} type="button" className={days.includes(i) ? 'sel' : ''} onClick={() => toggleDay(i)}>{DOW_LABELS[i]}</button>
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

function HabitEditForm({ habit, uid, isAdmin, onSave, onCancel }) {
  const [name, setName] = useState(habit.name);
  const [type, setType] = useState(habit.type);
  const [shared, setShared] = useState(!!habit.shared);
  const [points, setPoints] = useState(habit.points);
  const [unit, setUnit] = useState(habit.unit || '');
  const [target, setTarget] = useState(habit.target || 1);
  const [step, setStep] = useState(habit.step || 1);
  const [days, setDays] = useState(() => habitDays(habit, uid, today()));

  function toggleDay(i) {
    setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));
  }

  function save() {
    if (!name.trim() || !days.length) return;
    // Los días son un compromiso de cada usuario: no se guardan en el hábito global.
    const patch = { name: name.trim(), type, shared };
    if (isAdmin) patch.points = Number(points) || habit.points;
    if (habit.kind === 'quantity') {
      patch.unit = unit.trim() || habit.unit;
      patch.target = Number(target) || habit.target;
      patch.step = Number(step) || habit.step;
    }
    onSave(patch, days);
  }

  return (
    <div className="admin-panel">
      <div className="field-row"><input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field-row cols-2">
        {isAdmin ? (
          <input type="number" min="1" value={points} onChange={(e) => setPoints(e.target.value)} />
        ) : (
          <div className="hmeta" style={{ alignSelf: 'center' }}>Peso: {habit.points} (solo admin)</div>
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
        {WEEK_ORDER.map((i) => (
          <button key={i} type="button" className={days.includes(i) ? 'sel' : ''} onClick={() => toggleDay(i)}>{DOW_LABELS[i]}</button>
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

export default function Habits({ onEditCommitments, currentMultiplier = 1, habits, habitLogs, currentUser, isAdmin, actions, trackingStartDate }) {
  const t = today();
  const [editingId, setEditingId] = useState(null);
  const [jokers, refreshJokers, nextJoker] = useJokerBalance(currentUser.id, [habitLogs]);
  const mult = currentMultiplier || 1;
  useHabitReminders(habits, habitLogs, currentUser.id, trackingStartDate);

  // Comodín: cuenta como cumplido (0 pts) y no rompe la racha.
  async function applyJoker(habit, existingEntry) {
    if (jokers < 1) return;
    if (!window.confirm(`¿Usar 1 comodín en "${habit.name}"? Cuenta como cumplido y no suma puntos.`)) return;
    const amount = habit.kind === 'quantity' ? habit.target : null;
    const { error } = existingEntry
      ? await supabase.from('habit_logs').update({ points: 0, amount }).eq('id', existingEntry.id)
      : await supabase.from('habit_logs').upsert(
          [{ habit_id: habit.id, user_id: currentUser.id, log_date: dateKey(t), points: 0, amount }],
          { onConflict: 'habit_id,user_id,log_date' }
        );
    if (error) { window.alert('No se pudo usar el comodín.'); return; }
    // Se descuenta de "Mis comodines" (para vos y, si fuera compartido, para los dos).
    if (nextJoker) await supabase.from('redemption_uses').insert([{ redemption_id: nextJoker.id, user_id: currentUser.id }]);
    refreshJokers();
  }

  // Adelantar: cambia de día el hábito. El día futuro deja de corresponder y hoy pasa a ser
  // su día (queda pendiente: lo marcás vos como cualquier otro).
  async function advance(habit, date) {
    if (!window.confirm(`¿Mover "${habitLabel(habit)}" del ${DAY_NAMES[date.getDay()]} a hoy? Hoy pasa a ser su día y el ${DAY_NAMES[date.getDay()]} deja de corresponder.`)) return;
    await moveHabitDay(currentUser.id, habit.id, dateKey(date), dateKey(t));
  }

  // Recuperar: se valida de nuevo al hacer click (el día en curso nunca se toca).
  function recover(h) {
    const entry = findRecoverableMiss(h, currentUser.id, habitLogs, trackingStartDate);
    if (!entry || entry.log_date >= dateKey(today())) return;
    actions.requestRecovery(entry, h);
  }

  // Cambiar los días desde "editar" = cambiar TU compromiso con ese hábito (y, si es el
  // de gym, tus días de entrenamiento). Antes se guardaban en el hábito global y no
  // tenían efecto sobre el compromiso del usuario.
  async function saveMyDays(habit, newDays) {
    const current = habitDays(habit, currentUser.id, t) || [];
    const same = current.length === newDays.length && current.every((d) => newDays.includes(d));
    if (same) return true;
    if (habit.type === 'gym' && (newDays.length < 2 || newDays.length > 5)) {
      window.alert('Para entrenar elegí entre 2 y 5 días por semana.');
      return false;
    }
    const c = getCommitment(currentUser.id) || {};
    const next = { ...c, habitDays: { ...(c.habitDays || {}), [habit.id]: newDays } };
    if (habit.type === 'gym') next.trainDays = WEEK_ORDER.filter((d) => newDays.includes(d));
    await saveCommitment(currentUser.id, next);
    return true;
  }

  return (
    <section className="screen active">
      <h2 className="section-title">Hábitos de la semana</h2>
      <div className="hmeta" style={{ marginBottom: 10 }}>
        El día cierra a las 04:00 AM · Comodines: <b>{jokers}</b>
      </div>
      {onEditCommitments && (
        <button className="btn btn-ghost btn-small" style={{ marginBottom: 12 }} onClick={onEditCommitments}>📅 Mis compromisos</button>
      )}
      {habits.map((h) => {
        if (editingId === h.id) {
          return (
            <HabitEditForm
              key={h.id}
              habit={h}
              uid={currentUser.id}
              isAdmin={isAdmin}
              onCancel={() => setEditingId(null)}
              onSave={async (patch, newDays) => {
                const ok = await saveMyDays(h, newDays);
                if (!ok) return;
                actions.updateHabit(h.id, patch);
                setEditingId(null);
              }}
            />
          );
        }

        const myDays = habitDays(h, currentUser.id, t);
        const scheduledToday = isScheduled(h, currentUser.id, t);
        const dayLabels = myDays.length === 7 ? 'Todos los días' : WEEK_ORDER.filter((d) => myDays.includes(d)).map((d) => DOW_LABELS[d]).join(' ');

        if (h.kind === 'quantity') {
          const key = dateKey(t);
          const entry = habitLogs.find((e) => e.habit_id === h.id && e.user_id === currentUser.id && e.log_date === key);
          const amount = entry?.amount || 0;
          const pct = Math.min(100, Math.round((amount / h.target) * 100));
          return (
            <div className={'habit-card' + (pct >= 100 ? ' is-done' : '')} key={h.id}>
              <div className="habit-row">
                <div
                  className={'check' + (pct >= 100 ? ' done' : '') + (scheduledToday ? '' : ' disabled')}
                  onClick={() => scheduledToday && actions.addQuantity(h, currentUser.id, pct >= 100 ? -amount : h.target - amount)}
                >{pct >= 100 ? '✓' : ''}</div>
                <div className="habit-info">
                  <div className="hname">{habitLabel(h)}{h.shared ? ' 🤝' : ''}</div>
                  <div className="hmeta">{dayLabels} · meta {h.target} {h.unit}/día</div>
                </div>
                {scheduledToday && <StatusTag status={habitDayStatus(h, t, currentUser.id, habitLogs, trackingStartDate)} />}
                <div className="habit-pts">hasta +{Math.round(habitValue(h, currentUser.id, t, habits) * mult)}</div>
                <button className="rm" style={{ color: 'var(--court-light)' }} onClick={() => setEditingId(h.id)}>✎</button>
                {isAdmin && (
                  <button className="rm" onClick={() => window.confirm(`¿Eliminar "${habitLabel(h)}"?`) && actions.deleteHabit(h.id)}>✕</button>
                )}
              </div>
              <div className="qty-block">
                <div className="qty-bar-row"><span><b>{amount}</b> / {h.target} {h.unit}</span><span>{pct}%</span></div>
                <div className="bar-track"><div className="bar-fill" style={{ width: pct + '%' }} /></div>
                {scheduledToday ? (
                  <>
                    <QtyControls habit={h} onAdd={(delta) => actions.addQuantity(h, currentUser.id, delta)} />
                    {pct < 100 && (
                      <button className="btn btn-primary btn-small" style={{ marginTop: 8, width: '100%' }} onClick={() => actions.addQuantity(h, currentUser.id, h.target - amount)}>✓ Marcar meta como hecha</button>
                    )}
                    {jokers > 0 && pct < 100 && (
                      <button className="btn btn-ghost btn-small" style={{ marginTop: 8 }} onClick={() => applyJoker(h, entry)}>🃏 Usar comodín hoy</button>
                    )}
                  </>
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
        const pendingRec = recoverable ? pendingRecovery(currentUser.id, h.id) : null;
        const advanceDate = findAdvanceTarget(h, currentUser.id, habitLogs, trackingStartDate);
        const jokerTarget = jokers > 0 ? findJokerTarget(h, currentUser.id, habitLogs, trackingStartDate) : null;
        const todayEntry = habitLogs.find((e) => e.habit_id === h.id && e.user_id === currentUser.id && e.log_date === dateKey(t));
        return (
          <div className={'habit-card' + (done ? ' is-done' : '')} key={h.id}>
            <div className="habit-row">
              <div
                className={'check ' + (done ? 'done ' : '') + (scheduledToday || pendingRec ? '' : 'disabled')}
                onClick={() => (scheduledToday || pendingRec) && actions.toggleHabitToday(h, currentUser.id)}
              >
                {done ? '✓' : ''}
              </div>
              <div className="habit-info">
                <div className="hname">{habitLabel(h)}{h.shared ? ' 🤝' : ''}</div>
                <div className="hmeta">{dayLabels}{scheduledToday ? '' : ' · no corresponde hoy'}</div>
              </div>
              {scheduledToday && <StatusTag status={status} />}
              <div className="habit-pts">+{Math.round(habitValue(h, currentUser.id, t, habits) * mult)}{h.shared ? ' · x2 si ambos' : ''}</div>
              <button className="rm" style={{ color: 'var(--court-light)' }} onClick={() => setEditingId(h.id)}>✎</button>
              {isAdmin && (
                <button className="rm" onClick={() => window.confirm(`¿Eliminar "${habitLabel(h)}"?`) && actions.deleteHabit(h.id)}>✕</button>
              )}
            </div>
            {recoverable && !pendingRec && (
              <div className="recover-row">
                <span>Tenés un día perdido esta semana en "{habitLabel(h)}". Si lo hacés hoy, lo recuperás.</span>
                <button className="btn btn-ghost btn-small" onClick={() => recover(h)}>Recuperar con hoy</button>
              </div>
            )}
            {recoverable && pendingRec && (
              <div className="recover-row">
                <span>
                  Recuperación pendiente: hacelo hoy{h.type === 'run' ? ' (registralo en Cardio)' : h.type === 'gym' ? ' (completá la rutina)' : ''} y marcalo ✓ para recuperar el día perdido. No suma hasta que lo hagas.
                </span>
                <button className="btn btn-ghost btn-small" onClick={() => actions.cancelRecovery(h, currentUser.id)}>Cancelar</button>
              </div>
            )}
            {done && h.kind === 'boolean' && h.type !== 'run' && (
              <div className="recover-row">
                <span>¿Lo hiciste una 2.ª vez hoy? Cuenta como sesión extra (1 por semana).</span>
                <button
                  className="btn btn-ghost btn-small"
                  onClick={async () => {
                    const r = await actions.extraSession(h, currentUser.id);
                    if (r && !r.ok) window.alert(r.reason);
                  }}
                >➕ Sesión extra +{Math.max(1, Math.round(habitValue(h, currentUser.id, t, habits) * EXTRA_SESSION_FACTOR * mult))}</button>
              </div>
            )}
            {advanceDate && (
              <div className="recover-row">
                <span>Hoy no corresponde. ¿Querés pasar el del {DAY_NAMES[advanceDate.getDay()]} a hoy?</span>
                <button className="btn btn-ghost btn-small" onClick={() => advance(h, advanceDate)}>⏩ Mover a hoy</button>
              </div>
            )}
            {jokers > 0 && (status === 'pending' || jokerTarget) && (
              <div className="recover-row">
                <span>{status === 'pending' ? 'Saltá este hábito hoy sin perder la racha.' : 'Cubrí un día perdido sin romper la racha.'}</span>
                <button className="btn btn-ghost btn-small" onClick={() => applyJoker(h, status === 'pending' ? todayEntry : jokerTarget)}>🃏 Usar comodín</button>
              </div>
            )}
            <WeekStrip habit={h} currentUser={currentUser} habitLogs={habitLogs} trackingStartDate={trackingStartDate} />
          </div>
        );
      })}

      {isAdmin && (
        <div className="admin-panel">
          <label className="flabel">Tabla de puntos (tus compromisos actuales)</label>
          {habits.map((h) => {
            const n = habitDays(h, currentUser.id, t).length;
            const v = habitValue(h, currentUser.id, t, habits);
            const step = h.kind === 'quantity' && h.target ? ` · +${Math.max(1, Math.round((v * (h.step || 1)) / h.target))} por ${h.step || 1} ${h.unit || ''}` : '';
            return (
              <div className="set-row" key={h.id}>
                <span className="spec">{habitLabel(h)} · peso {h.points} · {n} d/sem{step}</span>
                <b>{v} c/u · {v * n}/sem</b>
              </div>
            );
          })}
          <div className="hmeta" style={{ marginTop: 6 }}>
            Semana perfecta con tus días: {habits.reduce((sum, h) => sum + habitDays(h, currentUser.id, t).length * habitValue(h, currentUser.id, t, habits), 0)} pts (+ bonos).
          </div>
        </div>
      )}

      {isAdmin && <HabitCreateForm onAdd={actions.addHabit} isAdmin={isAdmin} />}

      {isAdmin && (
        <div className="admin-panel" style={{ borderColor: 'var(--coral)' }}>
          <label className="flabel" style={{ color: 'var(--coral)' }}>Zona de peligro</label>
          <div className="hmeta" style={{ marginBottom: 10 }}>
            Borra todo el historial de hábitos, bonos, cardio, entrenamientos, canjes y comodines, y arranca el conteo de nuevo desde hoy. No se puede deshacer.
          </div>
          <button
            className="btn btn-ghost"
            style={{ width: '100%', borderColor: 'var(--coral)', color: 'var(--coral)' }}
            onClick={() => {
              if (window.confirm('¿Reiniciar TODO el progreso (calendario, puntos y canjes)? Esta acción no se puede deshacer.')) {
                Promise.resolve(actions.resetAllProgress()).then((r) => { if (r && r.ok === false) window.alert(r.message); });
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
