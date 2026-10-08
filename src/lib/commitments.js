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
export async function saveCommitment(uid, data) {
  const full = { ...data, since: dateKey(today()) };
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

export function isScheduled(habit, date) {
  if (!habit) return false;
  // Verifica si el hábito está programado para esa fecha o día de la semana
  if (habit.scheduled_date) return habit.scheduled_date === date;
  if (habit.days && Array.isArray(habit.days)) {
    const dow = new Date(date).getDay();
    return habit.days.includes(dow);
  }
  return true;
}
// Función para mover/adelantar la fecha de un hábito sin marcarlo completado
export function moveHabitDay(habit, targetDate) {
  if (!habit) return habit;
  return {
    ...habit,
    scheduled_date: targetDate
  };
}