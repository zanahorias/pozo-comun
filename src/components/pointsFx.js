// Bus mínimo para mostrar "+10" / "-5" flotando cada vez que suman o restan puntos.
const subs = new Set();
export const showPoints = (delta, label = '') => { if (delta) subs.forEach((f) => f(delta, label)); };
export const subscribePoints = (f) => { subs.add(f); return () => subs.delete(f); };
