export const DOW_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // 0=domingo..6=sábado
export const CAL_DOW_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']; // calendario arranca en lunes

// El "día" de hábitos y rutinas cierra a las 04:00 AM: antes de esa hora
// todavía se está registrando el día anterior.
export const CUTOFF_HOUR = 4;

export function stripTime(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function dateKey(d) {
  const dt = stripTime(d);
  return (
    dt.getFullYear() +
    '-' +
    String(dt.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(dt.getDate()).padStart(2, '0')
  );
}

// Instante "efectivo": ahora menos CUTOFF_HOUR horas.
export function effectiveNow() {
  return new Date(Date.now() - CUTOFF_HOUR * 3600 * 1000);
}

// "Hoy" respetando el corte de las 04:00.
export function today() {
  return stripTime(effectiveNow());
}

// Próximo corte (04:00) a partir de ahora.
export function nextCutoff() {
  const n = new Date();
  const c = new Date(n.getFullYear(), n.getMonth(), n.getDate(), CUTOFF_HOUR, 0, 0, 0);
  if (c <= n) c.setDate(c.getDate() + 1);
  return c;
}

export function fmtShort(d) {
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: 'short' });
}

export function mondayOfWeek(d) {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return monday;
}
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // lunes → domingo (para selectores de días)
