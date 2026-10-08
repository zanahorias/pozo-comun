import { habitDays } from './commitments';

// ============================================================================
// ECONOMÍA DE PUNTOS (todo el sistema se ajusta desde acá)
// ============================================================================
// Idea central: una "semana perfecta" (cumplir TODO lo que te comprometiste, con
// el horario por defecto de los hábitos) vale WEEK_BASE puntos base. Sobre eso se
// suman los bonos (día perfecto, rachas). El refresco cuesta casi una semana así.
//
// El campo `points` de cada hábito en la base de datos pasa a ser un PESO RELATIVO:
// un hábito con 10 vale el doble que uno con 5. La escala real se calcula sola para
// que la semana de referencia siempre sume WEEK_BASE, sin importar qué números
// tengan hoy los hábitos en Supabase.

export const WEEK_BASE = 700; // puntos base de una semana perfecta (referencia)
export const DAY_REF = 100;   // ≈ WEEK_BASE / 7: lo que rinde un día perfecto (barra de "hoy")

// Bonos (mismos `kind` que antes, solo cambian los montos).
export const BONUS_POINTS = { perfect_day: 15, streak3: 30, streak7: 80 };

// Con bonos, una semana perfecta ≈ 700 + 7×15 + 30 + 80 = 915.
// El refresco ("Gustito / Soda / Snack") cuesta casi eso: ~6 días perfectos.
export const SODA_PRICE = 800;

// Compromiso: cuantos más días por semana te comprometés a un hábito, más vale
// cada vez que lo cumplís (y más duele fallarlo). 1 día → ×0.8 … 7 días → ×1.4.
export function commitFactor(nDays) {
  const n = Math.min(7, Math.max(1, Number(nDays) || 1));
  return 0.8 + 0.1 * (n - 1);
}

// Puntos totales por semana = días × valor por día = n × factor(n): crece más
// que linealmente (3 días: 3.0 · 5 días: 6.0 · 7 días: 9.8).
const defaultDays = (h) => (Array.isArray(h.days) && h.days.length ? h.days.length : 7);

// Pisos y topes para que ningún hábito quede "regalado" ni desproporcionado aunque en la
// base tenga un peso muy bajo o muy alto:
// - ningún hábito pesa menos que MIN_SHARE × el peso promedio,
// - ninguno pesa más que MAX_SHARE × el peso promedio,
// - ninguna cumplida vale menos que MIN_HABIT_VALUE puntos.
// Además, el cardio (hábito tipo "run") pesa igual que el gym: una sesión de cardio vale
// lo mismo que una sesión de entrenamiento con los mismos días por semana.
export const MIN_SHARE = 0.5;
export const MAX_SHARE = 2;
export const MIN_HABIT_VALUE = 10;

const rawWeight = (h) => Number(h.points) || 1;

function weightOf(habit, habits = []) {
  const list = habits.length ? habits : [habit];
  const gym = list.find((x) => x.type === 'gym');
  const own = habit.type === 'run' && gym ? rawWeight(gym) : rawWeight(habit);
  const mean = list.reduce((s, x) => s + rawWeight(x), 0) / list.length;
  return Math.min(MAX_SHARE * mean, Math.max(MIN_SHARE * mean, own));
}

// Escala que hace que la semana de referencia (horario por defecto) sume WEEK_BASE.
export function pointScale(habits = []) {
  const raw = habits.reduce((s, h) => {
    const n = defaultDays(h);
    return s + weightOf(h, habits) * n * commitFactor(n);
  }, 0);
  return raw > 0 ? WEEK_BASE / raw : 1;
}

// Valor de UNA cumplida de `habit`, dado cuántos días por semana se comprometió.
export function valueForDays(habit, nDays, habits = []) {
  return Math.max(MIN_HABIT_VALUE, Math.round(pointScale(habits) * weightOf(habit, habits) * commitFactor(nDays)));
}

// Valor de una cumplida de `habit` para `uid` en `dateObj` (sin multiplicadores).
export function habitValue(habit, uid, dateObj, habits = []) {
  const days = habitDays(habit, uid, dateObj);
  const n = Array.isArray(days) && days.length ? days.length : defaultDays(habit);
  return valueForDays(habit, n, habits);
}
