import { stripTime, dateKey, today, mondayOfWeek } from './dates';

function effectiveStart(habit, trackingStartDate) {
  const habitStart = habit.created_at ? stripTime(new Date(habit.created_at)) : null;
  const candidates = [habitStart, trackingStartDate || null].filter(Boolean);
  if (!candidates.length) return new Date(0);
  return candidates.reduce((a, b) => (a > b ? a : b));
}

export function habitDayStatus(habit, dateObj, uid, habitLogs, trackingStartDate) {
  if (!habit.days.includes(dateObj.getDay())) return 'none';
  const d = stripTime(dateObj);
  const t = today();
  if (d > t) return 'future';

  const key = dateKey(d);
  const entry = habitLogs.find(
    (e) => e.habit_id === habit.id && e.user_id === uid && e.log_date === key
  );
  if (entry) {
    if (habit.kind === 'quantity' && (entry.amount || 0) < habit.target) return 'partial';
    return entry.points < 0 ? 'missed' : 'done';
  }

  const start = effectiveStart(habit, trackingStartDate);
  if (d < start) return 'none';

  return d.getTime() === t.getTime() ? 'pending' : 'missed';
}

// Regla del calendario: verde si se cumplieron TODOS los hábitos programados
// y relevantes de ese día, amarillo si se cumplió ALGUNO (no todos), rojo si
// no se cumplió NINGUNO. "Cumplido" cuenta tanto 'done' como 'partial' (algo
// de progreso en un hábito por cantidad ya es mejor que nada).
export function dayAggregateStatus(habits, dateObj, uid, habitLogs, trackingStartDate) {
  const scheduled = habits.filter((h) => h.days.includes(dateObj.getDay()));
  const relevant = scheduled.filter(
    (h) => habitDayStatus(h, dateObj, uid, habitLogs, trackingStartDate) !== 'none'
  );
  if (!relevant.length) return 'none';
  const d = stripTime(dateObj);
  const t = today();
  if (d > t) return 'future';

  let doneCount = 0;
  relevant.forEach((h) => {
    const s = habitDayStatus(h, dateObj, uid, habitLogs, trackingStartDate);
    if (s === 'done' || s === 'partial') doneCount++;
  });
  if (doneCount === 0) return 'missed';
  if (doneCount === relevant.length) return 'done';
  return 'partial';
}

export function pool(habitLogs, redemptions, bonusLogs = []) {
  const earned = habitLogs.reduce((s, e) => s + e.points, 0);
  const bonus = bonusLogs.reduce((s, e) => s + e.points, 0);
  const spent = redemptions.reduce((s, r) => s + r.points_spent, 0);
  return earned + bonus - spent;
}

export function todayFor(uid, habitLogs, bonusLogs = []) {
  const tk = dateKey(today());
  const h = habitLogs
    .filter((e) => e.user_id === uid && e.log_date === tk && e.points > 0)
    .reduce((s, e) => s + e.points, 0);
  const b = bonusLogs
    .filter((e) => e.user_id === uid && e.log_date === tk)
    .reduce((s, e) => s + e.points, 0);
  return h + b;
}

export function computeMissingRows(habits, users, habitLogs, trackingStartDate) {
  const t = today();
  const monthStart = new Date(t.getFullYear(), t.getMonth(), 1);
  const rows = [];
  habits.forEach((habit) => {
    const habitStart = effectiveStart(habit, trackingStartDate);
    const rangeStart = habitStart > monthStart ? habitStart : monthStart;
    users.forEach((u) => {
      let d = new Date(rangeStart);
      while (d < t) {
        if (habit.days.includes(d.getDay())) {
          const key = dateKey(d);
          const exists = habitLogs.some(
            (e) => e.habit_id === habit.id && e.user_id === u.id && e.log_date === key
          );
          if (!exists) {
            rows.push({
              habit_id: habit.id,
              user_id: u.id,
              log_date: key,
              amount: null,
              points: -habit.points
            });
          }
        }
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      }
    });
  });
  return rows;
}

// --- Recuperar un día perdido en un día no programado ---------------------

// Busca el hábito "sí/no" no cumplido más antiguo de ESTA semana (lun-hoy)
// para poder recuperarlo usando cualquier otro día.
export function findRecoverableMiss(habit, uid, habitLogs, trackingStartDate) {
  if (habit.kind !== 'boolean') return null;
  const t = today();
  const monday = mondayOfWeek(t);
  let d = new Date(monday);
  while (d <= t) {
    const status = habitDayStatus(habit, d, uid, habitLogs, trackingStartDate);
    if (status === 'missed') {
      const key = dateKey(d);
      const entry = habitLogs.find(
        (e) => e.habit_id === habit.id && e.user_id === uid && e.log_date === key
      );
      if (entry) return entry;
    }
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return null;
}

// --- Rachas y día perfecto --------------------------------------------------

// "Día perfecto": todos los hábitos programados ese día (que ya existían)
// quedaron en estado 'done' para ese usuario. Si no había ningún hábito
// programado y relevante ese día, no cuenta como perfecto ni como roto.
export function isPerfectDay(habits, dateObj, uid, habitLogs, trackingStartDate) {
  const scheduled = habits.filter((h) => h.days.includes(dateObj.getDay()));
  const relevant = scheduled.filter(
    (h) => habitDayStatus(h, dateObj, uid, habitLogs, trackingStartDate) !== 'none'
  );
  if (!relevant.length) return false;
  return relevant.every(
    (h) => habitDayStatus(h, dateObj, uid, habitLogs, trackingStartDate) === 'done'
  );
}

// Cantidad de días perfectos consecutivos terminando hoy (si hoy todavía no
// es perfecto, arranca a contar desde ayer).
export function currentStreak(habits, uid, habitLogs, trackingStartDate) {
  let streak = 0;
  let d = today();
  while (isPerfectDay(habits, d, uid, habitLogs, trackingStartDate)) {
    streak++;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  }
  return streak;
}
