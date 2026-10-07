import { stripTime, dateKey, today, mondayOfWeek, effectiveNow } from './dates';
import { habitDays, isScheduled } from './commitments';

function effectiveStart(habit, trackingStartDate) {
  const habitStart = habit.created_at ? stripTime(new Date(habit.created_at)) : null;
  const candidates = [habitStart, trackingStartDate || null].filter(Boolean);
  if (!candidates.length) return new Date(0);
  return candidates.reduce((a, b) => (a > b ? a : b));
}

export function habitDayStatus(habit, dateObj, uid, habitLogs, trackingStartDate) {
  if (!isScheduled(habit, uid, dateObj)) return 'none';
  const d = stripTime(dateObj);
  const t = today();
  const key = dateKey(d);
  const entry = habitLogs.find(
    (e) => e.habit_id === habit.id && e.user_id === uid && e.log_date === key
  );
  if (d > t) return entry ? 'done' : 'future'; // 'done' = día adelantado
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
  const scheduled = habits.filter((h) => isScheduled(h, uid, dateObj));
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

// ---------------------------------------------------------------------------
// ECONOMÍA HÍBRIDA Q4
// ---------------------------------------------------------------------------
// Nombre a mostrar: el hábito de salir a correr ahora se llama Cardio.
export const habitLabel = (h) => (h.type === 'run' && /correr|run|trot/i.test(h.name) ? 'Cardio' : h.name);

export const SCOPE = { INDIVIDUAL: 'individual', SHARED: 'shared' };

// Fracción de los puntos ganados por cada uno que también alimenta el Pozo Común.
export const POOL_FEED_RATE = 1;
// Bonus al Pozo cuando AMBOS cumplen el mismo hábito compartido el mismo día
// (múltiplo de los puntos del hábito).
// Ahora el x2 de los hábitos compartidos ya está dentro de los puntos de cada log,
// así que no se suma un bonus aparte al Pozo.
export const SHARED_POOL_BONUS_MULT = 0;

// Precios "exigentes": con ~50 pts por día por persona, un gustito cuesta ~3 semanas y un
// comodín ~3 meses. Para endurecer o aflojar todo a la vez, cambiá PRICE_SCALE (1 = base).
export const PRICE_SCALE = 1;
const P = (n) => Math.max(50, Math.round((n * PRICE_SCALE) / 50) * 50);

// Máximo de canjes SIN USAR por recompensa (evita acumular comodines y actividades).
export const MAX_STOCK = 1;

export const Q4_CATALOG = [
  { name: 'Gustito / Soda / Snack', emoji: '🥤', cost: P(900), scope: 'individual', description: 'Un gustito para vos.' },
  { name: 'Tiempo de Gaming / Cine', emoji: '🎮', cost: P(1800), scope: 'individual', description: 'Gaming o cine individual.' },
  { name: 'Salida corta / Desayuno afuera', emoji: '🥐', cost: P(2700), scope: 'individual', description: 'Una salida corta o desayuno afuera.' },
  { name: 'Comodín de descanso', emoji: '🃏', cost: P(5000), scope: 'individual', description: 'Saltá 1 hábito sin perder la racha.' },
  { name: 'Postre / helado juntos', emoji: '🍨', cost: P(2200), scope: 'shared', description: 'Postre o helado de a dos.' },
  { name: 'Elegir la peli o serie de la semana', emoji: '🎬', cost: P(1800), scope: 'shared', description: 'Quien canjea elige qué ver.' },
  { name: 'Noche de juegos de mesa + snacks', emoji: '🎲', cost: P(3000), scope: 'shared', description: 'Juegos de mesa con picada.' },
  { name: 'Desayuno en la cama', emoji: '🥞', cost: P(3500), scope: 'shared', description: 'Desayuno servido en la cama.' },
  { name: 'Día sin tareas del hogar', emoji: '🧹', cost: P(5000), scope: 'shared', description: 'El otro se encarga de las tareas del día.' },
  { name: 'Picnic en el parque', emoji: '🧺', cost: P(5000), scope: 'shared', description: 'Picnic armado para los dos.' },
  { name: 'Cine juntos (entradas + pochoclos)', emoji: '🎟️', cost: P(7000), scope: 'shared', description: 'Entradas y pochoclos incluidos.' },
  { name: 'Clase o taller nuevo juntos', emoji: '👩‍🍳', cost: P(12000), scope: 'shared', description: 'Cocina, baile, cerámica… algo nuevo.' },
  { name: 'Noche de hotel en la ciudad', emoji: '🏨', cost: P(17000), scope: 'shared', description: 'Una noche de hotel de a dos.' },
  { name: 'Show / concierto / evento', emoji: '🎤', cost: P(19000), scope: 'shared', description: 'Entradas para un show o evento.' },
  { name: 'Noche de películas + delivery', emoji: '🍿', cost: P(4000), scope: 'shared', description: 'Peli en casa y pedido a elección.' },
  { name: 'Brunch / café juntos', emoji: '☕', cost: P(5500), scope: 'shared', description: 'Desayuno o café largo de a dos.' },
  { name: 'Masaje en casa', emoji: '💆', cost: P(6500), scope: 'shared', description: 'Masaje o noche de relax en casa.' },
  { name: 'Salida / Cena especial juntos', emoji: '🍽️', cost: P(8500), scope: 'shared', description: 'Cena o salida especial de a dos.' },
  { name: 'Regalo sorpresa mutuo', emoji: '🎁', cost: P(9500), scope: 'shared', description: 'Cada uno le regala algo al otro.' },
  { name: 'Día de actividad juntos', emoji: '🚴', cost: P(11000), scope: 'shared', description: 'Paseo, parque o actividad al aire libre.' },
  { name: 'Spa / Día de bienestar', emoji: '🧖', cost: P(13000), scope: 'shared', description: 'Spa o jornada de bienestar de a dos.' },
  { name: 'Fondo equipamiento / App upgrade', emoji: '🛠️', cost: P(15000), scope: 'shared', description: 'Equipamiento o upgrade de app.' },
  { name: 'Escapada de fin de semana', emoji: '🏖️', cost: P(24000), scope: 'shared', description: 'Meta Q4: escapada de fin de semana.' }
];

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// El scope se guarda como prefijo en la descripción ([ind] / [pozo]) para no
// tocar el esquema. Si agregás una columna `scope` a `rewards`, se usa primero.
export function parseReward(reward) {
  let desc = reward.description || '';
  let scope = reward.scope || null;
  const m = desc.match(/^\[(ind|pozo)\]\s*/i);
  if (m) {
    if (!scope) scope = m[1].toLowerCase() === 'ind' ? SCOPE.INDIVIDUAL : SCOPE.SHARED;
    desc = desc.slice(m[0].length);
  }
  if (!scope) {
    const cat = Q4_CATALOG.find((c) => norm(c.name) === norm(reward.name));
    scope = cat ? cat.scope : reward.cost_points >= 5000 ? SCOPE.SHARED : SCOPE.INDIVIDUAL;
  }
  const isJoker = /comodin/.test(norm(reward.name));
  return { scope, description: desc, isJoker };
}

export function encodeScope(description, scope) {
  return (scope === SCOPE.SHARED ? '[pozo] ' : '[ind] ') + (description || '');
}

export function rewardScope(reward) {
  return parseReward(reward).scope;
}

// Puntos ganados por un usuario (hábitos + bonos; incluye penalidades negativas).
export function earnedBy(uid, habitLogs, bonusLogs = []) {
  const h = habitLogs.filter((e) => e.user_id === uid).reduce((s, e) => s + e.points, 0);
  const b = bonusLogs.filter((e) => e.user_id === uid).reduce((s, e) => s + e.points, 0);
  return h + b;
}

// Bonificación automática al Pozo: hábitos compartidos que cumplieron TODOS
// los usuarios el mismo día (derivada de los logs, por eso es idempotente).
export function sharedPoolBonus(habits, users, habitLogs) {
  if (!users.length) return 0;
  let total = 0;
  habits.filter((h) => h.shared).forEach((h) => {
    const byDate = {};
    habitLogs.forEach((e) => {
      if (e.habit_id === h.id && e.points > 0) (byDate[e.log_date] = byDate[e.log_date] || new Set()).add(e.user_id);
    });
    Object.values(byDate).forEach((set) => {
      if (users.every((u) => set.has(u.id))) total += Math.round(h.points * SHARED_POOL_BONUS_MULT);
    });
  });
  return total;
}

// Saldo individual: lo que ganó el usuario menos SUS canjes individuales.
export function individualBalance(uid, habitLogs, bonusLogs, redemptions, rewards) {
  const spent = redemptions
    .filter((r) => r.redeemed_by === uid)
    .filter((r) => {
      const rw = rewards.find((x) => x.id === r.reward_id);
      return !rw || rewardScope(rw) === SCOPE.INDIVIDUAL;
    })
    .reduce((s, r) => s + r.points_spent, 0);
  return earnedBy(uid, habitLogs, bonusLogs) - spent;
}

// Balance compartido (Pozo Común): aporte de ambos + bonus de hábitos
// compartidos − canjes de Pozo (de cualquiera de los dos).
export function poolBalance({ habits = [], users = [], habitLogs, bonusLogs = [], redemptions, rewards = [] }) {
  const earned = habitLogs.reduce((s, e) => s + e.points, 0) + bonusLogs.reduce((s, e) => s + e.points, 0);
  const spent = redemptions
    .filter((r) => {
      const rw = rewards.find((x) => x.id === r.reward_id);
      return rw && rewardScope(rw) === SCOPE.SHARED;
    })
    .reduce((s, r) => s + r.points_spent, 0);
  return Math.round(earned * POOL_FEED_RATE) + sharedPoolBonus(habits, users, habitLogs) - spent;
}

// Compatibilidad con Board.jsx: con `rewards` resta SOLO los canjes de Pozo;
// sin `rewards` se comporta como antes.
export function pool(habitLogs, redemptions, bonusLogs = [], rewards = null) {
  const earned = habitLogs.reduce((s, e) => s + e.points, 0);
  const bonus = bonusLogs.reduce((s, e) => s + e.points, 0);
  const reds = rewards
    ? redemptions.filter((r) => {
        const rw = rewards.find((x) => x.id === r.reward_id);
        return rw && rewardScope(rw) === SCOPE.SHARED;
      })
    : redemptions;
  return earned + bonus - reds.reduce((s, r) => s + r.points_spent, 0);
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
        if (isScheduled(habit, u.id, d)) {
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

// --- Recuperar un día perdido ---------------------------------------------

// Busca el hábito "sí/no" no cumplido más antiguo de ESTA semana (lun-ayer).
// Reglas: nunca toca el día en curso (no se puede pre-completar hoy) y solo se
// ofrece si HOY no corresponde al hábito (el día de hoy no se cuenta doble).
export function findRecoverableMiss(habit, uid, habitLogs, trackingStartDate) {
  if (habit.kind !== 'boolean') return null;
  const t = today();
  if (isScheduled(habit, uid, t)) return null;
  const monday = mondayOfWeek(t);
  let d = new Date(monday);
  while (d < t) {
    const status = habitDayStatus(habit, d, uid, habitLogs, trackingStartDate);
    if (status === 'missed') {
      const key = dateKey(d);
      const entry = habitLogs.find(
        (e) => e.habit_id === habit.id && e.user_id === uid && e.log_date === key
      );
      if (entry && entry.log_date < dateKey(t)) return entry;
    }
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return null;
}

// Último día faltado de la semana (cualquier tipo) para aplicar un comodín.
export function findJokerTarget(habit, uid, habitLogs, trackingStartDate) {
  const t = today();
  let d = mondayOfWeek(t);
  while (d < t) {
    if (habitDayStatus(habit, d, uid, habitLogs, trackingStartDate) === 'missed') {
      const key = dateKey(d);
      const entry = habitLogs.find((e) => e.habit_id === habit.id && e.user_id === uid && e.log_date === key);
      if (entry) return entry;
    }
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return null;
}

// Un log con 0 puntos = comodín usado (cuenta como cumplido, no suma puntos).
export const isJokerLog = (e) => e.points === 0;

// --- Recordatorios (notificaciones locales) --------------------------------

export const REMINDER_HOURS = [20, 23];

// Hábitos programados HOY que siguen sin cumplirse completamente.
export function incompleteToday(habits, uid, habitLogs, trackingStartDate) {
  const t = today();
  return habits.filter((h) => {
    const s = habitDayStatus(h, t, uid, habitLogs, trackingStartDate);
    return s === 'pending' || s === 'partial';
  });
}

// Próximo recordatorio (20:00 o 23:00) antes del corte de las 04:00.
export function nextReminder(now = new Date()) {
  const eff = effectiveNow();
  const candidates = [];
  [0, 1].forEach((add) => {
    REMINDER_HOURS.forEach((h) => {
      candidates.push(new Date(eff.getFullYear(), eff.getMonth(), eff.getDate() + add, h, 0, 0, 0));
    });
  });
  const next = candidates.find((c) => c > now);
  return next ? { at: next, hour: next.getHours(), key: dateKey(new Date(next.getTime() - 4 * 3600 * 1000)) + '-' + next.getHours() } : null;
}

// --- Rachas y día perfecto --------------------------------------------------

// "Día perfecto": todos los hábitos programados ese día (que ya existían)
// quedaron en estado 'done' para ese usuario. Si no había ningún hábito
// programado y relevante ese día, no cuenta como perfecto ni como roto.
export function isPerfectDay(habits, dateObj, uid, habitLogs, trackingStartDate) {
  const scheduled = habits.filter((h) => isScheduled(h, uid, dateObj));
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

// --- Adelantar hábitos -------------------------------------------------------

// Si hoy NO corresponde el hábito, devuelve el próximo día de esta semana en que sí
// corresponde y todavía no está registrado: ese día se puede mover a hoy.
export function findAdvanceTarget(habit, uid, habitLogs, trackingStartDate) {
  if (habit.kind !== 'boolean') return null;
  const t = today();
  if (isScheduled(habit, uid, t)) return null;
  const end = new Date(mondayOfWeek(t));
  end.setDate(end.getDate() + 6);
  let d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
  while (d <= end) {
    if (habitDayStatus(habit, d, uid, habitLogs, trackingStartDate) === 'future') return new Date(d);
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return null;
}

// --- Comodines de descanso (se descuentan con redemption_uses) ---------------

// Disponibles = comodines canjeados − usados. `zeroLogs` (logs con 0 pts) cubre usos viejos.
export function jokerState(rewards, redemptions, uses, uid, zeroLogs = 0) {
  const usedIds = new Set((uses || []).map((u) => u.redemption_id));
  const mine = redemptions.filter((r) => {
    const rw = rewards.find((x) => x.id === r.reward_id);
    return rw && r.redeemed_by === uid && parseReward(rw).isJoker;
  });
  const usedCount = Math.max(mine.filter((r) => usedIds.has(r.id)).length, zeroLogs);
  const unused = mine.filter((r) => !usedIds.has(r.id)).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return { available: Math.max(0, mine.length - usedCount), nextToUse: unused[0] || null };
}
