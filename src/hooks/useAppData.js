import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { dateKey, mondayOfWeek, stripTime, today } from '../lib/dates';
import { computeMissingRows, currentStreak, isPerfectDay, rewardScope, SCOPE } from '../lib/logic';
import { loadCommitments, clearAllMoves, isScheduled, pendingRecovery, setPendingRecovery, clearPendingRecovery } from '../lib/commitments';
import { habitValue, BONUS_POINTS, EXTRA_SESSION_FACTOR } from '../lib/economy';

const MONTH_START_KEY = () => {
  const t = today();
  const start = new Date(t.getFullYear(), t.getMonth(), 1);
  return dateKey(start);
};

export function useAppData() {
  const [users, setUsers] = useState([]);
  const [habits, setHabits] = useState([]);
  const [habitLogs, setHabitLogs] = useState([]);
  const [bonusLogs, setBonusLogs] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [trackingStartDate, setTrackingStartDate] = useState(null);
  const [adminPin, setAdminPin] = useState(1234);
  const [currentGoal, setCurrentGoal] = useState(null);
  const [goalProgress, setGoalProgress] = useState(0);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [multiplierInfo, setMultiplierInfo] = useState(null); // { source, expiresAt }
  const [userTotals, setUserTotals] = useState({}); // { [userId]: totalPoints }
  const [poolTotal, setPoolTotal] = useState(0); // saldo del Pozo Común (todo el historial)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const monthStart = MONTH_START_KEY();
      const nowIso = new Date().toISOString();
      const [u, h, hl, bl, w, r, red, settings, goalRes, multRes, hlAll, blAll, tpMonth, tpAll, redAll] = await Promise.all([
        supabase.from('users').select('*').order('created_at'),
        supabase.from('habits').select('*').eq('active', true).order('created_at'),
        supabase.from('habit_logs').select('*').gte('log_date', monthStart),
        supabase.from('bonus_logs').select('*').gte('log_date', monthStart),
        supabase.from('workouts').select('*').order('created_at', { ascending: false }).limit(60),
        supabase.from('rewards').select('*').eq('active', true).order('cost_points'),
        supabase.from('redemptions').select('*').order('redeemed_at', { ascending: false }).limit(20),
        supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('goals').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('active_multipliers').select('*').gt('expires_at', nowIso).order('expires_at', { ascending: false }),
        supabase.from('habit_logs').select('user_id, points'),
        supabase.from('bonus_logs').select('user_id, points'),
        // Puntos por entrenar (ejercicios / rutina completa). Si la tabla no existe, se ignora.
        supabase.from('training_points').select('*').gte('log_date', monthStart),
        supabase.from('training_points').select('user_id, points'),
        supabase.from('redemptions').select('reward_id, points_spent')
      ]);
      if (u.error) throw u.error;
      if (h.error) throw h.error;
      if (hl.error) throw hl.error;
      if (w.error) throw w.error;
      if (r.error) throw r.error;
      if (red.error) throw red.error;

      const tsd = settings?.data?.tracking_start_date
        ? stripTime(new Date(settings.data.tracking_start_date + 'T00:00:00'))
        : null;
      const pin = settings?.data?.admin_pin || null;
      const goal = goalRes?.data || null;

      let progress = 0;
      if (goal) {
        const [hl2, bl2, tp2] = await Promise.all([
          supabase.from('habit_logs').select('points').gte('log_date', goal.start_date).gt('points', 0),
          supabase.from('bonus_logs').select('points').gte('log_date', goal.start_date),
          supabase.from('training_points').select('points').gte('log_date', goal.start_date)
        ]);
        progress =
          (hl2.data || []).reduce((s, e) => s + e.points, 0) +
          (bl2.data || []).reduce((s, e) => s + e.points, 0) +
          (tp2.data || []).reduce((s, e) => s + e.points, 0);
      }

      const activeMults = multRes?.data || [];
      let mult = 1;
      let multInfo = null;
      activeMults.forEach((m) => {
        if (m.multiplier > mult) {
          mult = m.multiplier;
          multInfo = { source: m.source, expiresAt: m.expires_at };
        }
      });

      const totals = {};
      (u.data || []).forEach((usr) => (totals[usr.id] = 0));
      (hlAll?.data || []).forEach((e) => {
        totals[e.user_id] = (totals[e.user_id] || 0) + e.points;
      });
      (blAll?.data || []).forEach((e) => {
        totals[e.user_id] = (totals[e.user_id] || 0) + e.points;
      });
      (tpAll?.data || []).forEach((e) => {
        totals[e.user_id] = (totals[e.user_id] || 0) + e.points;
      });

      setUsers(u.data || []);
      setHabits(h.data || []);
      setHabitLogs(hl.data || []);
      // Los puntos de entrenamiento se muestran junto a los bonos (misma forma).
      setBonusLogs([...(bl.data || []), ...(tpMonth?.data || [])]);
      setWorkouts(w.data || []);
      setRewards(r.data || []);
      setRedemptions(red.data || []);
      setTrackingStartDate(tsd);
      setAdminPin(pin);
      setCurrentGoal(goal);
      setGoalProgress(progress);
      setCurrentMultiplier(mult);
      setMultiplierInfo(multInfo);
      setUserTotals(totals);
      // Pozo Común = lo ganado entre todos − canjes de recompensas del Pozo.
      const sharedSpent = (redAll?.data || []).reduce((sum, x) => {
        const rw = (r.data || []).find((y) => y.id === x.reward_id);
        return rw && rewardScope(rw) === SCOPE.SHARED ? sum + x.points_spent : sum;
      }, 0);
      setPoolTotal(Object.values(totals).reduce((a, b) => a + b, 0) - sharedSpent);
      setError(null);
      return { users: u.data || [], habits: h.data || [], habitLogs: hl.data || [], trackingStartDate: tsd };
    } catch (e) {
      console.error(e);
      setError(e.message || 'Error cargando datos');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadCommitments(); // los días por usuario deben estar antes de calcular faltantes
      const initial = await fetchAll();
      if (!initial) return;
      const missing = computeMissingRows(initial.habits, initial.users, initial.habitLogs, initial.trackingStartDate);
      if (missing.length) {
        await supabase
          .from('habit_logs')
          .upsert(missing, { onConflict: 'habit_id,user_id,log_date', ignoreDuplicates: true });
        fetchAll();
      }
    })();
  }, [fetchAll]);

  useEffect(() => {
    const channel = supabase
      .channel('pozo-comun-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_logs' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_logs' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'training_points' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workouts' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'redemptions' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habits' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rewards' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_multipliers' }, fetchAll)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchAll]);

  async function fetchMonthLogs(year, month) {
    const start = dateKey(new Date(year, month, 1));
    const end = dateKey(new Date(year, month + 1, 1));
    const { data, error: err } = await supabase
      .from('habit_logs')
      .select('*')
      .gte('log_date', start)
      .lt('log_date', end);
    if (err) {
      console.error(err);
      return [];
    }
    return data || [];
  }

  async function awardBonusesIfNeeded(userId, fresh) {
    if (!fresh) return false;
    const { habits: freshHabits, habitLogs: freshLogs, trackingStartDate: tsd } = fresh;
    const t = today();
    const tk = dateKey(t);
    const rows = [];

    if (isPerfectDay(freshHabits, t, userId, freshLogs, tsd)) {
      rows.push({ user_id: userId, kind: 'perfect_day', points: BONUS_POINTS.perfect_day, log_date: tk });
      const streak = currentStreak(freshHabits, userId, freshLogs, tsd);
      if (streak === 3) rows.push({ user_id: userId, kind: 'streak3', points: BONUS_POINTS.streak3, log_date: tk });
      if (streak === 7) rows.push({ user_id: userId, kind: 'streak7', points: BONUS_POINTS.streak7, log_date: tk });
    }

    if (!rows.length) return false;
    await supabase
      .from('bonus_logs')
      .upsert(rows, { onConflict: 'user_id,kind,log_date', ignoreDuplicates: true });
    return true;
  }

  // Hábito compartido: si HOY lo cumplen los dos, los puntos de ambos se duplican (x2).
  // Una sola vez por día y por hábito (la marca queda en shared_bonus_log).
  const isHabitDone = (habit, e) => (habit.kind === 'quantity' ? (e.amount || 0) >= habit.target : e.points > 0);

  async function checkSharedHabitBonus(habit, fresh) {
    if (!habit?.shared || !fresh || users.length < 2) return false;
    const tk = dateKey(today());
    const logs = fresh.habitLogs.filter((e) => e.habit_id === habit.id && e.log_date === tk && isHabitDone(habit, e));
    if (!users.every((usr) => logs.some((e) => e.user_id === usr.id))) return false;
    const { error: insErr } = await supabase.from('shared_bonus_log').insert([{ habit_id: habit.id, log_date: tk }]);
    if (insErr) return false; // ya estaba duplicado hoy
    await Promise.all(
      logs.map((e) => supabase.from('habit_logs').update({ points: e.points * 2 }).eq('id', e.id))
    );
    return true;
  }

  const hasSharedMark = async (habit, key) => {
    if (!habit?.shared) return false;
    const { data } = await supabase.from('shared_bonus_log').select('habit_id').eq('habit_id', habit.id).eq('log_date', key);
    return !!(data && data.length);
  };

  // Si alguien deja de cumplir, se quita el x2 al otro usuario.
  async function undoSharedDouble(habit, key, exceptUserId) {
    if (!(await hasSharedMark(habit, key))) return;
    await supabase.from('shared_bonus_log').delete().eq('habit_id', habit.id).eq('log_date', key);
    const { data: logs } = await supabase
      .from('habit_logs').select('id,points')
      .eq('habit_id', habit.id).eq('log_date', key).neq('user_id', exceptUserId).gt('points', 0);
    await Promise.all((logs || []).map((e) => supabase.from('habit_logs').update({ points: Math.round(e.points / 2) }).eq('id', e.id)));
  }

  // Si el día deja de ser perfecto (desmarcaste algo), se quitan los bonos del día:
  // así marcar y desmarcar suman y restan exactamente lo mismo.
  async function revokeBonusesIfNeeded(userId, fresh) {
    if (!fresh) return false;
    const t = today();
    if (isPerfectDay(fresh.habits, t, userId, fresh.habitLogs, fresh.trackingStartDate)) return false;
    const { data } = await supabase
      .from('bonus_logs').select('id')
      .eq('user_id', userId).eq('log_date', dateKey(t)).in('kind', ['perfect_day', 'streak3', 'streak7']);
    if (!data || !data.length) return false;
    await supabase.from('bonus_logs').delete().in('id', data.map((x) => x.id));
    return true;
  }

  async function afterHabitAction(userId, habit) {
    const fresh = await fetchAll();
    const a = await awardBonusesIfNeeded(userId, fresh);
    const b = habit ? await checkSharedHabitBonus(habit, fresh) : false;
    const c = await revokeBonusesIfNeeded(userId, fresh);
    if (a || b || c) fetchAll();
  }

  async function toggleHabitToday(habit, userId, opts = {}) {
    const key = dateKey(today());
    // Se consulta la base (no el estado) para no actuar sobre datos viejos.
    const { data: fresh0 } = await supabase
      .from('habit_logs').select('id,points')
      .eq('habit_id', habit.id).eq('user_id', userId).eq('log_date', key).limit(1);
    const existing = fresh0 && fresh0[0];
    // Día en que el hábito no corresponde + recuperación pendiente: marcarlo = recuperar el día perdido.
    if (!isScheduled(habit, userId, today()) && (await applyPendingRecovery(habit, userId))) {
      await afterHabitAction(userId, habit);
      return;
    }
    if (existing && existing.points > 0) {
      await supabase.from('habit_logs').delete().eq('id', existing.id);
      await undoSharedDouble(habit, key, userId);
      // Desmarcar el hábito de gym desmarca TODOS los ejercicios de hoy (y sus puntos).
      if (habit.type === 'gym' && !opts.keepExercises) {
        const t0 = today();
        const dayStart = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate(), 4, 0, 0).toISOString();
        await supabase.from('training_points').delete().eq('user_id', userId).eq('log_date', key).or('kind.like.ex_%,kind.eq.routine_done');
        await supabase.from('workouts').delete().eq('user_id', userId).eq('type', 'strength').gte('created_at', dayStart);
      }
    } else {
      let points = Math.round(habitValue(habit, userId, today(), habits) * currentMultiplier);
      if (habit.type === 'gym') {
        // Los ejercicios ya completados hoy cuentan: el total del día nunca supera el valor del hábito.
        const { data: tp } = await supabase
          .from('training_points').select('points').eq('user_id', userId).eq('log_date', key).like('kind', 'ex_%');
        const got = (tp || []).reduce((s, r) => s + r.points, 0);
        points = Math.max(1, points - got);
      }
      await supabase.from('habit_logs').upsert(
        [{ habit_id: habit.id, user_id: userId, log_date: key, points, amount: null }],
        { onConflict: 'habit_id,user_id,log_date' }
      );
    }
    await afterHabitAction(userId, habit);
  }

  async function addQuantity(habit, userId, delta) {
    const key = dateKey(today());
    const existing = habitLogs.find(
      (e) => e.habit_id === habit.id && e.user_id === userId && e.log_date === key
    );
    const current = existing?.amount || 0;
    const next = Math.max(0, current + delta);
    const marked = await hasSharedMark(habit, key);
    if (next <= 0) {
      if (existing) await supabase.from('habit_logs').delete().eq('id', existing.id);
      if (marked) await undoSharedDouble(habit, key, userId);
    } else {
      const basePts = Math.round(habitValue(habit, userId, today(), habits) * Math.min(1, next / habit.target));
      let pts = Math.round(basePts * currentMultiplier);
      if (marked && next >= habit.target) pts *= 2;
      await supabase.from('habit_logs').upsert(
        [{ habit_id: habit.id, user_id: userId, log_date: key, points: pts, amount: next }],
        { onConflict: 'habit_id,user_id,log_date' }
      );
      if (marked && next < habit.target) await undoSharedDouble(habit, key, userId);
    }
    await afterHabitAction(userId, habit);
  }

  // Sesión extra (2.ª vez del día): máximo UNA por semana por hábito. Se guarda en
  // training_points con kind 'extra_<id del hábito>'. Devuelve { ok, points, reason }.
  async function grantExtraSession(habit, userId) {
    const monday = dateKey(mondayOfWeek(today()));
    const kind = 'extra_' + habit.id;
    const { data: used } = await supabase
      .from('training_points').select('id').eq('user_id', userId).eq('kind', kind).gte('log_date', monday).limit(1);
    if (used && used.length) return { ok: false, points: 0, reason: 'Ya usaste la sesión extra de este hábito esta semana (se renueva el lunes).' };
    const points = Math.max(1, Math.round(habitValue(habit, userId, today(), habits) * EXTRA_SESSION_FACTOR * currentMultiplier));
    const { error: err } = await supabase.from('training_points').insert([{ user_id: userId, kind, points, log_date: dateKey(today()) }]);
    if (err) return { ok: false, points: 0, reason: 'No se pudo guardar la sesión extra: ' + err.message };
    return { ok: true, points };
  }

  // Botón "Sesión extra" de la tarjeta del hábito (para hábitos que no son cardio).
  async function extraSession(habit, userId) {
    const key = dateKey(today());
    const { data } = await supabase
      .from('habit_logs').select('points').eq('habit_id', habit.id).eq('user_id', userId).eq('log_date', key).limit(1);
    if (!(data && data[0] && data[0].points > 0)) {
      return { ok: false, points: 0, reason: 'Primero completá el hábito hoy; la sesión extra es la segunda vez.' };
    }
    const res = await grantExtraSession(habit, userId);
    if (res.ok) await afterHabitAction(userId, habit);
    return res;
  }

  async function autoCompleteHabitByType(type, userId) {
    const habit = habits.find((h) => h.type === type);
    if (!habit) return;
    const key = dateKey(today());
    // Se consulta la base (no el estado) para no actuar sobre datos viejos entre dos sesiones seguidas.
    const { data: ex0 } = await supabase
      .from('habit_logs').select('id,points')
      .eq('habit_id', habit.id).eq('user_id', userId).eq('log_date', key).limit(1);
    const existing = ex0 && ex0[0];
    // Una sesión real hoy con recuperación pendiente: esa sesión recupera el día perdido.
    // Una sesión extra después sí suma lo de hoy (más sesiones = más puntos).
    if (!isScheduled(habit, userId, today()) && (await applyPendingRecovery(habit, userId))) return null;
    // Ya contaba hoy: esta es la 2.ª sesión del día → sesión extra (1 por semana).
    if (existing && existing.points > 0) return { extra: await grantExtraSession(habit, userId) };
    const points = Math.round(habitValue(habit, userId, today(), habits) * currentMultiplier);
    await supabase.from('habit_logs').upsert(
      [{ habit_id: habit.id, user_id: userId, log_date: key, points, amount: null }],
      { onConflict: 'habit_id,user_id,log_date' }
    );
  }

  async function logGym(userId, exercise, sets) {
    await supabase.from('workouts').insert([
      { user_id: userId, type: 'strength', exercise_name: exercise, sets }
    ]);
    // El hábito de ejercicio se completa desde Training al terminar la rutina (o a mano).
    const habit = habits.find((h) => h.type === 'gym');
    await afterHabitAction(userId, habit);
  }

  // activity: 'Trote' | 'Caminata' | 'Bici' | 'Otro' (se guarda en exercise_name)
  async function logRun(userId, durationMin, distanceKm, activity = 'Trote') {
    await supabase.from('workouts').insert([
      { user_id: userId, type: 'cardio', exercise_name: activity, duration_min: durationMin, distance_km: distanceKm }
    ]);
    const res = await autoCompleteHabitByType('run', userId);
    const habit = habits.find((h) => h.type === 'run');
    await afterHabitAction(userId, habit);
    return res || null;
  }

  async function redeem(reward, userId) {
    await supabase.from('redemptions').insert([
      { reward_id: reward.id, redeemed_by: userId, points_spent: reward.cost_points }
    ]);
    // El canje queda guardado en "Mis comodines"; los multiplicadores se activan al usarlos (Shop).
    fetchAll();
  }

  async function addHabit(habit) {
    await supabase.from('habits').insert([habit]);
    fetchAll();
  }

  async function addReward(reward) {
    await supabase.from('rewards').insert([reward]);
    fetchAll();
  }

  async function deleteHabit(habitId) {
    await supabase.from('habits').update({ active: false }).eq('id', habitId);
    fetchAll();
  }

  async function deleteReward(rewardId) {
    await supabase.from('rewards').update({ active: false }).eq('id', rewardId);
    fetchAll();
  }

  async function updateReward(rewardId, patch) {
    await supabase.from('rewards').update(patch).eq('id', rewardId);
    fetchAll();
  }

  async function updateHabit(habitId, patch) {
    await supabase.from('habits').update(patch).eq('id', habitId);
    fetchAll();
  }

  // "Recuperar con hoy" solo deja la recuperación PENDIENTE (no suma nada).
  async function requestRecovery(entry, habit) {
    await setPendingRecovery(entry.user_id, habit.id, entry.log_date);
  }

  async function cancelRecovery(habit, userId) {
    await clearPendingRecovery(userId, habit.id);
  }

  // Se llama cuando el hábito se hace de verdad hoy: si había una recuperación pendiente,
  // el día perdido pasa a sumar. Devuelve true si se aplicó (esa vez ya no cuenta el de hoy).
  async function applyPendingRecovery(habit, userId) {
    const pend = pendingRecovery(userId, habit.id);
    if (!pend) return false;
    const { data } = await supabase
      .from('habit_logs').select('id,points')
      .eq('habit_id', habit.id).eq('user_id', userId).eq('log_date', pend.missKey).limit(1);
    const row = data && data[0];
    await clearPendingRecovery(userId, habit.id);
    if (!row || row.points > 0 || pend.missKey >= dateKey(today())) return false;
    await supabase.from('habit_logs')
      .update({ points: habitValue(habit, userId, new Date(pend.missKey + 'T00:00:00'), habits), amount: null })
      .eq('id', row.id);
    return true;
  }

  async function setGoal(title, targetPoints, rewardText) {
    await supabase.from('goals').update({ active: false }).eq('active', true);
    await supabase.from('goals').insert([
      { title, target_points: targetPoints, reward_text: rewardText, start_date: dateKey(today()) }
    ]);
    fetchAll();
  }

  async function clearGoal() {
    await supabase.from('goals').update({ active: false }).eq('active', true);
    fetchAll();
  }

  // Borra todo el historial (hábitos, bonos, entrenamientos, cardio, canjes y
  // comodines usados), saca las marcas del calendario y mueve la fecha de inicio
  // de conteo a hoy, para arrancar de cero. Devuelve { ok, message }.
  async function resetAllProgress() {
    // 1) Primero la fecha de inicio: si no se puede guardar, NO se borra nada.
    //    Sin esa fecha, al vaciar los registros todos los días pasados quedarían
    //    marcados como "no cumplidos" (✕ rojo).
    const start = dateKey(today());
    const readStart = async () => {
      const { data } = await supabase.from('app_settings').select('tracking_start_date').eq('id', 1).maybeSingle();
      return data ? String(data.tracking_start_date || '').slice(0, 10) : null;
    };
    const errors = [];
    // Primero update (como antes); .select() para saber si realmente tocó una fila.
    const up = await supabase.from('app_settings').update({ tracking_start_date: start }).eq('id', 1).select('id');
    if (up.error) errors.push('update: ' + up.error.message);
    let saved = !up.error && (up.data || []).length > 0 && (await readStart()) === start;
    if (!saved) {
      const ins = await supabase.from('app_settings').upsert({ id: 1, tracking_start_date: start }, { onConflict: 'id' });
      if (ins.error) errors.push('upsert: ' + ins.error.message);
      saved = (await readStart()) === start;
    }
    if (!saved) {
      console.warn('Reset: no se pudo guardar tracking_start_date', errors);
      return {
        ok: false,
        message:
          'No se pudo guardar la fecha de inicio en app_settings. No se borró nada.\n\n' +
          (errors.length ? errors.join('\n') : 'Supabase no devolvió error, pero la fila no cambió (probablemente falta una policy de UPDATE para la tabla).')
      };
    }

    const wipe = async (table, col) => {
      const { error: err } = await supabase.from(table).delete().not(col, 'is', null);
      if (err) console.warn('Reset: no se pudo vaciar ' + table, err.message);
    };
    // redemption_uses (comodines usados) va antes que redemptions por la clave foránea.
    await wipe('redemption_uses', 'redemption_id');
    await wipe('habit_logs', 'id');
    await wipe('bonus_logs', 'id');
    await wipe('training_points', 'id');
    await wipe('workouts', 'id'); // incluye cardio (type = 'cardio') y fuerza
    await wipe('redemptions', 'id');
    await wipe('shared_bonus_log', 'habit_id');
    await wipe('active_multipliers', 'id');
    await clearAllMoves(); // días "adelantados" que dejaban marcas en el calendario
    await fetchAll();
    return { ok: true };
  }

  return {
    users,
    habits,
    habitLogs,
    bonusLogs,
    workouts,
    rewards,
    redemptions,
    trackingStartDate,
    adminPin,
    currentGoal,
    goalProgress,
    currentMultiplier,
    multiplierInfo,
    userTotals,
    poolTotal,
    loading,
    error,
    fetchMonthLogs,
    actions: {
      refresh: fetchAll,
      toggleHabitToday,
      addQuantity,
      logGym,
      logRun,
      redeem,
      addHabit,
      addReward,
      deleteHabit,
      deleteReward,
      updateReward,
      updateHabit,
      requestRecovery,
      extraSession,
      cancelRecovery,
      setGoal,
      clearGoal,
      resetAllProgress
    }
  };
}
