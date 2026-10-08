import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { dateKey, today } from './dates';

// Compromisos por usuario: qué días se compromete a cada hábito y a entrenar.
// Se guardan en Supabase (tabla user_commitments, ver supabase-commitments.sql)
// y se espejan en localStorage por si la tabla todavía no existe.
const LS = 'arriba-commit-';
const cache = {};
const listeners = new Set();
const notify = () => listeners.forEach((f) => f());

export async function loadCommitments() {
  try {
    const { data, error } = await supabase.from('user_commitments').select('*');
    if (!error && data) data.forEach((r) => { cache[r.user_id] = r.data; });
  } catch (e) {
    console.warn('user_commitments no disponible, uso localStorage', e);
  }
  notify();
}

export function getCommitment(uid) {
  if (cache[uid]) return cache[uid];
  try {
    const s = localStorage.getItem(LS + uid);
    if (s) return JSON.parse(s);
  } catch (e) { /* ignore */ }
  return null;
}

export const hasCommitment = (uid) => !!getCommitment(uid);

// data: { habitDays: {[habitId]: number[]}, trainDays: number[] }
export async function saveCommitment(uid, data, opts = {}) {
  const full = { ...data, since: opts.keepSince && data.since ? data.since : dateKey(today()) };
  cache[uid] = full;
  try { localStorage.setItem(LS + uid, JSON.stringify(full)); } catch (e) { /* ignore */ }
  notify();
  try {
    await supabase.from('user_commitments').upsert({ user_id: uid, data: full }, { onConflict: 'user_id' });
  } catch (e) {
    console.warn(e);
  }
}

// Días en que `habit` aplica para `uid`. Antes de la fecha del compromiso se
// usan los días originales del hábito (no se castiga el pasado retroactivamente).
export function habitDays(habit, uid, dateObj) {
  const c = getCommitment(uid);
  const mine = c?.habitDays?.[habit.id];
  if (!Array.isArray(mine)) return habit.days;
  if (dateObj && c.since && dateKey(dateObj) < c.since) return habit.days;
  return mine;
}

export const trainDaysOf = (uid) => getCommitment(uid)?.trainDays || null;

// Fuerza un re-render del árbol cuando cambian los compromisos.
export function useCommitments() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const f = () => setV((x) => x + 1);
    listeners.add(f);
    loadCommitments();
    return () => listeners.delete(f);
  }, []);
  return v;
}

// ¿Corresponde el hábito ese día? Tiene en cuenta los días movidos ("adelantar").
export function isScheduled(habit, uid, dateObj) {
  const c = getCommitment(uid);
  const key = dateKey(dateObj);
  const moves = (c?.moves || []).filter((m) => m.habitId === habit.id);
  if (moves.some((m) => m.to === key)) return true;
  if (moves.some((m) => m.from === key)) return false;
  return habitDays(habit, uid, dateObj).includes(dateObj.getDay());
}

// Adelantar = cambiar el día del hábito: deja de corresponder en `fromKey` y pasa a hoy.
export async function moveHabitDay(uid, habitId, fromKey, toKey) {
  const c = getCommitment(uid);
  if (!c) return;
  const old = new Date(today());
  old.setDate(old.getDate() - 21);
  const limit = dateKey(old);
  const moves = (c.moves || []).filter((m) => m.to >= limit && !(m.habitId === habitId && m.from === fromKey));
  await saveCommitment(uid, { ...c, moves: [...moves, { habitId, from: fromKey, to: toKey }] }, { keepSince: true });
}

// Reinicio a cero: quita los días adelantados ("moves") de todos los compromisos.
export async function clearAllMoves() {
  const ids = Object.keys(cache);
  for (const uid of ids) {
    const c = cache[uid];
    if (c && c.moves && c.moves.length) await saveCommitment(uid, { ...c, moves: [] }, { keepSince: true });
  }
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(LS)).forEach((k) => {
      const c = JSON.parse(localStorage.getItem(k) || 'null');
      if (c && c.moves) localStorage.setItem(k, JSON.stringify({ ...c, moves: [] }));
    });
  } catch (e) { /* ignore */ }
}
