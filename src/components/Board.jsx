import { useEffect, useState } from 'react';
import { CAL_DOW_LABELS } from '../lib/dates';
import { dayAggregateStatus, pool, todayFor, currentStreak } from '../lib/logic';

function userName(users, uid) {
  return users.find((u) => u.id === uid)?.name || uid;
}

const BONUS_LABELS = {
  perfect_day: 'día perfecto',
  streak3: 'racha de 3 días',
  streak7: 'racha de 7 días'
};

function buildFeed(habitLogs, bonusLogs, workouts, redemptions, rewards, users) {
  const items = [];
  habitLogs.forEach((e) => {
    if (!e.created_at) return;
    items.push({
      ts: e.created_at,
      who: e.user_id,
      text: e.points < 0 ? 'no cumplió un hábito' : 'sumó puntos de un hábito',
      pts: e.points,
      sign: e.points < 0 ? 'minus' : 'plus'
    });
  });
  bonusLogs.forEach((b) => {
    items.push({
      ts: b.created_at,
      who: b.user_id,
      text: `logró ${BONUS_LABELS[b.kind] || 'un bono'} 🎉`,
      pts: b.points,
      sign: 'plus'
    });
  });
  workouts.forEach((w) => {
    items.push({
      ts: w.created_at,
      who: w.user_id,
      text: w.type === 'strength' ? `registró ${w.exercise_name}` : `registró una carrera de ${w.distance_km} km`,
      pts: null,
      sign: 'plus'
    });
  });
  redemptions.forEach((r) => {
    const reward = rewards.find((x) => x.id === r.reward_id);
    items.push({
      ts: r.redeemed_at,
      who: r.redeemed_by,
      text: `canjeó "${reward?.name || 'una recompensa'}"`,
      pts: -r.points_spent,
      sign: 'minus'
    });
  });
  return items.sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 8);
}

function GoalCard({ currentGoal, goalProgress, isAdmin, actions }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(currentGoal?.title || '');
  const [targetPoints, setTargetPoints] = useState(currentGoal?.target_points || 500);
  const [rewardText, setRewardText] = useState(currentGoal?.reward_text || '');

  function save() {
    if (!title.trim() || !targetPoints) return;
    actions.setGoal(title.trim(), Number(targetPoints), rewardText.trim());
    setEditing(false);
  }

  if (!currentGoal && !isAdmin) return null;

  if (!currentGoal || editing) {
    if (!isAdmin) return null;
    return (
      <div className="admin-panel">
        <label className="flabel">Objetivo en común</label>
        <div className="field-row"><input placeholder="Título, ej: Viaje de fin de año" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field-row cols-2">
          <input type="number" min="1" placeholder="Puntos meta" value={targetPoints} onChange={(e) => setTargetPoints(e.target.value)} />
          <input placeholder="Recompensa al llegar" value={rewardText} onChange={(e) => setRewardText(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>Guardar objetivo</button>
          {currentGoal && <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>}
        </div>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((goalProgress / currentGoal.target_points) * 100));
  return (
    <div className="cal-card" style={{ marginTop: 14 }}>
      <div className="cal-title">Objetivo en común</div>
      <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>{currentGoal.title}</div>
      {currentGoal.reward_text && <div className="hmeta" style={{ marginTop: 2 }}>Recompensa: {currentGoal.reward_text}</div>}
      <div className="qty-bar-row" style={{ marginTop: 10 }}>
        <span><b>{goalProgress}</b> / {currentGoal.target_points} pts</span>
        <span>{pct}%</span>
      </div>
      <div className="bar-track"><div className="bar-fill" style={{ width: pct + '%' }} /></div>
      {isAdmin && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <button className="btn btn-ghost btn-small" onClick={() => setEditing(true)}>Editar</button>
          <button className="btn btn-ghost btn-small" onClick={() => window.confirm('¿Borrar este objetivo?') && actions.clearGoal()}>Borrar</button>
        </div>
      )}
    </div>
  );
}

export default function Board({ users, habits, habitLogs, bonusLogs, workouts, rewards, redemptions, currentUser, trackingStartDate, fetchMonthLogs, currentGoal, goalProgress, currentMultiplier, multiplierInfo, isAdmin, actions }) {
  const total = pool(habitLogs, redemptions, bonusLogs, rewards);
  const feed = buildFeed(habitLogs, bonusLogs, workouts, redemptions, rewards, users);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const [viewYear, setViewYear] = useState(currentYear);
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [monthLogs, setMonthLogs] = useState(habitLogs);

  const isViewingCurrentMonth = viewYear === currentYear && viewMonth === currentMonth;

  useEffect(() => {
    let cancelled = false;
    if (isViewingCurrentMonth) {
      setMonthLogs(habitLogs);
      return;
    }
    fetchMonthLogs(viewYear, viewMonth).then((data) => {
      if (!cancelled) setMonthLogs(data);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, viewMonth, isViewingCurrentMonth, habitLogs]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    if (isViewingCurrentMonth) return;
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const first = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const monthLabel = first.toLocaleDateString('es-UY', { month: 'long', year: 'numeric' });

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(viewYear, viewMonth, day));

  return (
    <section className="screen active">
      <div className="pool-board">
        <div className="pool-label">Fondo compartido</div>
        <div className="pool-value">{total}</div>
        <div className="pool-sub">Suma lo cumplido, resta lo que quedó pendiente</div>
      </div>

      {currentMultiplier > 1 && (
        <div className="multiplier-banner">
          ✨ Multiplicador x{currentMultiplier} activo{multiplierInfo?.source ? ` — ${multiplierInfo.source}` : ''}
          {multiplierInfo?.expiresAt && (
            <span> · hasta las {new Date(multiplierInfo.expiresAt).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}</span>
          )}
        </div>
      )}

      <div className="today-row">
        {users.map((u) => {
          const val = todayFor(u.id, habitLogs, bonusLogs);
          const streak = currentStreak(habits, u.id, habitLogs, trackingStartDate);
          const pct = Math.min(100, Math.round((val / 15) * 100));
          return (
            <div className="today-card" key={u.id}>
              <div className="name">{u.name} · hoy</div>
              <div className="amount">{val} pts</div>
              <div className="bar-track"><div className="bar-fill" style={{ width: pct + '%' }} /></div>
              {streak > 0 && <div className="hmeta" style={{ marginTop: 6 }}>🔥 Racha: {streak} {streak === 1 ? 'día' : 'días'}</div>}
            </div>
          );
        })}
      </div>

      <GoalCard currentGoal={currentGoal} goalProgress={goalProgress} isAdmin={isAdmin} actions={actions} />

      <div className="section-head cal-nav-row">
        <button className="cal-nav-btn" onClick={prevMonth} aria-label="Mes anterior">‹</button>
        <span className="cal-title">{monthLabel}</span>
        <button className="cal-nav-btn" onClick={nextMonth} disabled={isViewingCurrentMonth} aria-label="Mes siguiente">›</button>
      </div>
      <div className="cal-card">
        <div className="cal-grid">
          {CAL_DOW_LABELS.map((l) => (
            <div className="cal-dow" key={l}>{l}</div>
          ))}
          {cells.map((d, i) =>
            d ? (
              <div key={i} className={'cal-day ' + dayAggregateStatus(habits, d, currentUser.id, monthLogs, trackingStartDate)}>
                {d.getDate()}
              </div>
            ) : (
              <div key={i} className="cal-day blank" />
            )
          )}
        </div>
        <div className="cal-legend">
          <span><i style={{ background: 'var(--green-soft)' }} />Todos los hábitos</span>
          <span><i style={{ background: 'var(--amber-soft)' }} />Algunos</span>
          <span><i style={{ background: 'var(--coral-soft)' }} />Ninguno</span>
          <span><i style={{ border: '1px dashed var(--line)' }} />Sin hábito ese día</span>
        </div>
      </div>

      <div className="section-head"><span className="feed-title">Actividad reciente</span></div>
      <div>
        {feed.length ? (
          feed.map((f, i) => (
            <div className="feed-item" key={i}>
              <div className="feed-dot" style={{ background: f.sign === 'minus' ? 'var(--coral)' : 'var(--amber)' }} />
              <span className="who">{userName(users, f.who)}</span>&nbsp;{f.text}
              {f.pts !== null && (
                <span className={'pts ' + f.sign}>
                  {f.sign === 'minus' ? '-' : '+'}
                  {Math.abs(f.pts)}
                </span>
              )}
            </div>
          ))
        ) : (
          <div className="empty">Todavía no hay actividad.</div>
        )}
      </div>
    </section>
  );
}
