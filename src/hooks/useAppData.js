import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { dateKey, stripTime, today } from '../lib/dates';
import { computeMissingRows, currentStreak, isPerfectDay } from '../lib/logic';

const BONUS_POINTS = { perfect_day: 10, streak3: 20, streak7: 50 };

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
  const [adminPin, setAdminPin] = useState(null);
  const [currentGoal, setCurrentGoal] = useState(null);
  const [goalProgress, setGoalProgress] = useState(0);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [multiplierInfo, setMultiplierInfo] = useState(null); // { source, expiresAt }
  const [userTotals, setUserTotals] = useState({}); // { [userId]: totalPoints }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const monthStart = MONTH_START_KEY();
      const nowIso = new Date().toISOString();
      const [u, h, hl, bl, w, r, red, settings, goalRes, multRes, hlAll, blAll] = await Promise.all([
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
        supabase.from('bonus_logs').select('user_id, points')
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
        const [hl2, bl2] = await Promise.all([
          supabase.from('habit_logs').select('points').gte('log_date', goal.start_date).gt('points', 0),
          supabase.from('bonus_logs').select('points').gte('log_date', goal.start_date)
        ]);
        progress =
          (hl2.data || []).reduce((s, e) => s + e.points, 0) +
          (bl2.data || []).reduce((s, e) => s + e.points, 0);
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

      setUsers(u.data || []);
      setHabits(h.data || []);
      setHabitLogs(hl.data || []);
      setBonusLogs(bl.data || []);
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

  // Si el hábito es "compartido" y hoy ya lo cumplieron los dos usuarios,
  // activa un multiplicador x2 por 24hs (una sola vez por día, por hábito).
  async function checkSharedHabitBonus(habit, fresh) {
    if (!habit?.shared || !fresh) return false;
    const { habitLogs: freshLogs } = fresh;
    const tk = dateKey(today());
    const allDone = users.every((u) =>
      freshLogs.some((e) => e.habit_id === habit.id && e.user_id === u.id && e.log_date === tk && e.points > 0)
    );
    if (!allDone) return false;
    const { error: insErr } = await supabase.from('shared_bonus_log').insert([{ habit_id: habit.id, log_date: tk }]);
    if (insErr) return false; // ya se había activado hoy
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    await supabase.from('active_multipliers').insert([
      { multiplier: 2, source: `Hábito compartido: ${habit.name}`, expires_at: expiresAt }
    ]);
    return true;
  }

  async function afterHabitAction(userId, habit) {
    const fresh = await fetchAll();
    const a = await awardBonusesIfNeeded(userId, fresh);
    const b = habit ? await checkSharedHabitBonus(habit, fresh) : false;
    if (a || b) fetchAll();
  }

  async function toggleHabitToday(habit, userId) {
    const key = dateKey(today());
    const existing = habitLogs.find(
      (e) => e.habit_id === habit.id && e.user_id === userId && e.log_date === key
    );
    if (existing && existing.points > 0) {
      await supabase.from('habit_logs').delete().eq('id', existing.id);
    } else {
      const points = Math.round(habit.points * currentMultiplier);
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
    if (next <= 0) {
      if (existing) await supabase.from('habit_logs').delete().eq('id', existing.id);
    } else {
      const basePts = Math.round(habit.points * Math.min(1, next / habit.target));
      const pts = Math.round(basePts * currentMultiplier);
      await supabase.from('habit_logs').upsert(
        [{ habit_id: habit.id, user_id: userId, log_date: key, points: pts, amount: next }],
        { onConflict: 'habit_id,user_id,log_date' }
      );
    }
    await afterHabitAction(userId, habit);
  }

  async function autoCompleteHabitByType(type, userId) {
    const habit = habits.find((h) => h.type === type);
    if (!habit) return;
    const key = dateKey(today());
    const existing = habitLogs.find(
      (e) => e.habit_id === habit.id && e.user_id === userId && e.log_date === key
    );
    if (existing && existing.points > 0) return;
    const points = Math.round(habit.points * currentMultiplier);
    await supabase.from('habit_logs').upsert(
      [{ habit_id: habit.id, user_id: userId, log_date: key, points, amount: null }],
      { onConflict: 'habit_id,user_id,log_date' }
    );
  }

  async function logGym(userId, exercise, sets) {
    await supabase.from('workouts').insert([
      { user_id: userId, type: 'strength', exercise_name: exercise, sets }
    ]);
    await autoCompleteHabitByType('gym', userId);
    const habit = habits.find((h) => h.type === 'gym');
    await afterHabitAction(userId, habit);
  }

  async function logRun(userId, durationMin, distanceKm) {
    await supabase.from('workouts').insert([
      { user_id: userId, type: 'cardio', duration_min: durationMin, distance_km: distanceKm }
    ]);
    await autoCompleteHabitByType('run', userId);
    const habit = habits.find((h) => h.type === 'run');
    await afterHabitAction(userId, habit);
  }

  async function redeem(reward, userId) {
    await supabase.from('redemptions').insert([
      { reward_id: reward.id, redeemed_by: userId, points_spent: reward.cost_points }
    ]);
    if (reward.kind === 'multiplier' && reward.multiplier_value) {
      const hours = reward.multiplier_hours || 24;
      const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      await supabase.from('active_multipliers').insert([
        { multiplier: reward.multiplier_value, source: reward.name, expires_at: expiresAt }
      ]);
    }
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

  async function recoverHabitDay(entry, habit) {
    await supabase.from('habit_logs').update({ points: habit.points, amount: null }).eq('id', entry.id);
    fetchAll();
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

  // Borra todo el historial de cumplimiento (hábitos, bonos y canjes) y
  // mueve la fecha de inicio de conteo a hoy, para arrancar de cero.
  async function resetAllProgress() {
    await supabase.from('habit_logs').delete().not('id', 'is', null);
    await supabase.from('bonus_logs').delete().not('id', 'is', null);
    await supabase.from('redemptions').delete().not('id', 'is', null);
    await supabase.from('shared_bonus_log').delete().not('habit_id', 'is', null);
    await supabase.from('active_multipliers').delete().not('id', 'is', null);
    await supabase.from('app_settings').update({ tracking_start_date: dateKey(today()) }).eq('id', 1);
    fetchAll();
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
    loading,
    error,
    fetchMonthLogs,
    actions: {
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
      recoverHabitDay,
      setGoal,
      clearGoal,
      resetAllProgress
    }
  };
}
