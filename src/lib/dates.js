export const DOW_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // 0=domingo..6=sábado
export const CAL_DOW_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']; // calendario arranca en lunes

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

export function today() {
  return stripTime(new Date());
}

export function fmtShort(d) {
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: 'short' });
}

export function mondayOfWeek(d) {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return monday;
}
