import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { dateKey, stripTime, today } from '../lib/dates';
import { computeMissingRows } from '../lib/logic';

const MONTH_START_KEY = () => {
  const t = today();
  const start = new Date(t.getFullYear(), t.getMonth(), 1);
  return dateKey(start);
};

export function useAppData() {
  const [users, setUsers] = useState([]);
  const [habits, setHabits] = useState([]);
  const [habitLogs, setHabitLogs] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [trackingStartDate, setTrackingStartDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const monthStart = MONTH_START_KEY();
      const [u, h, hl, w, r, red, settings] = await Promise.all([
        supabase.from('users').select('*').order('created_at'),
        supabase.from('habits').select('*').eq('active', true).order('created_at'),
        supabase.from('habit_logs').select('*').gte('log_date', monthStart),
        supabase.from('workouts').select('*').order('created_at', { ascending: false }).limit(30),
        supabase.from('rewards').select('*').eq('active', true).order('cost_points'),
        supabase.from('redemptions').select('*').order('redeemed_at', { ascending: false }).limit(20),
        supabase.from('app_settings').select('*').eq('id', 1).maybeSingle()
      ]);
      if (u.error) throw u.error;
      if (h.error) throw h.error;
      if (hl.error) throw hl.error;
      if (w.error) throw w.error;
      if (r.error) throw r.error;
      if (red.error) throw red.error;
      // app_settings puede no existir todavía si no se corrió la migración:
      // en ese caso simplemente no hay piso de fecha y se sigue como antes.
      const tsd = settings?.data?.tracking_start_date
        ? stripTime(new Date(settings.data.tracking_start_date + 'T00:00:00'))
        : null;

      setUsers(u.data || []);
      setHabits(h.data || []);
      setHabitLogs(hl.data || []);
      setWorkouts(w.data || []);
      setRewards(r.data || []);
      setRedemptions(red.data || []);
      setTrackingStartDate(tsd);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workouts' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'redemptions' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habits' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rewards' }, fetchAll)
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

  async function toggleHabitToday(habit, userId) {
    const key = dateKey(today());
    const existing = habitLogs.find(
      (e) => e.habit_id === habit.id && e.user_id === userId && e.log_date === key
    );
    if (existing && existing.points > 0) {
      await supabase.from('habit_logs').delete().eq('id', existing.id);
    } else {
      await supabase.from('habit_logs').upsert(
        [{ habit_id: habit.id, user_id: userId, log_date: key, points: habit.points, amount: null }],
        { onConflict: 'habit_id,user_id,log_date' }
      );
    }
    fetchAll();
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
      const pts = Math.round(habit.points * Math.min(1, next / habit.target));
      await supabase.from('habit_logs').upsert(
        [{ habit_id: habit.id, user_id: userId, log_date: key, points: pts, amount: next }],
        { onConflict: 'habit_id,user_id,log_date' }
      );
    }
    fetchAll();
  }

  async function autoCompleteHabitByType(type, userId) {
    const habit = habits.find((h) => h.type === type);
    if (!habit) return;
    const key = dateKey(today());
    const existing = habitLogs.find(
      (e) => e.habit_id === habit.id && e.user_id === userId && e.log_date === key
    );
    if (existing && existing.points > 0) return;
    await supabase.from('habit_logs').upsert(
      [{ habit_id: habit.id, user_id: userId, log_date: key, points: habit.points, amount: null }],
      { onConflict: 'habit_id,user_id,log_date' }
    );
    fetchAll();
  }

  async function logGym(userId, exercise, sets) {
    await supabase.from('workouts').insert([
      { user_id: userId, type: 'strength', exercise_name: exercise, sets }
    ]);
    await autoCompleteHabitByType('gym', userId);
    fetchAll();
  }

  async function logRun(userId, durationMin, distanceKm) {
    await supabase.from('workouts').insert([
      { user_id: userId, type: 'cardio', duration_min: durationMin, distance_km: distanceKm }
    ]);
    await autoCompleteHabitByType('run', userId);
    fetchAll();
  }

  async function redeem(reward, userId) {
    await supabase.from('redemptions').insert([
      { reward_id: reward.id, redeemed_by: userId, points_spent: reward.cost_points }
    ]);
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

  return {
    users,
    habits,
    habitLogs,
    workouts,
    rewards,
    redemptions,
    trackingStartDate,
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
      updateHabit
    }
  };
}
