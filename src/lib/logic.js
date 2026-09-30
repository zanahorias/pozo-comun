import { stripTime, dateKey, today } from './dates';

export function habitDayStatus(habit, dateObj, uid, habitLogs) {
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
  return d.getTime() === t.getTime() ? 'pending' : 'missed';
}

export function dayAggregateStatus(habits, dateObj, uid, habitLogs) {
  const scheduled = habits.filter((h) => h.days.includes(dateObj.getDay()));
  if (!scheduled.length) return 'none';
  const d = stripTime(dateObj);
  const t = today();
  if (d > t) return 'future';
  let anyMissed = false;
  let anyPartial = false;
  let anyPending = false;
  for (const h of scheduled) {
    const s = habitDayStatus(h, dateObj, uid, habitLogs);
    if (s === 'missed') anyMissed = true;
    if (s === 'partial') anyPartial = true;
    if (s === 'pending') anyPending = true;
  }
  if (anyMissed) return 'missed';
  if (anyPartial) return 'partial';
  if (anyPending) return 'pending';
  return 'done';
}

export function pool(habitLogs, redemptions) {
  const earned = habitLogs.reduce((s, e) => s + e.points, 0);
  const spent = redemptions.reduce((s, r) => s + r.points_spent, 0);
  return earned - spent;
}

export function todayFor(uid, habitLogs) {
  const tk = dateKey(today());
  return habitLogs
    .filter((e) => e.user_id === uid && e.log_date === tk && e.points > 0)
    .reduce((s, e) => s + e.points, 0);
}

// Filas de "hábito no cumplido" que faltan insertar para lo que va del mes,
// para cada hábito programado en un día ya pasado sin registro.
export function computeMissingRows(habits, users, habitLogs) {
  const t = today();
  const monthStart = new Date(t.getFullYear(), t.getMonth(), 1);
  const rows = [];
  habits.forEach((habit) => {
    users.forEach((u) => {
      let d = new Date(monthStart);
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
