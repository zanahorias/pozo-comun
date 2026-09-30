import { CAL_DOW_LABELS } from '../lib/dates';
import { dayAggregateStatus, pool, todayFor } from '../lib/logic';

function userName(users, uid) {
  return users.find((u) => u.id === uid)?.name || uid;
}

function buildFeed(habitLogs, workouts, redemptions, rewards, users) {
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

export default function Board({ users, habits, habitLogs, workouts, rewards, redemptions, currentUser }) {
  const total = pool(habitLogs, redemptions);
  const feed = buildFeed(habitLogs, workouts, redemptions, rewards, users);

  const t = new Date();
  const year = t.getFullYear();
  const month = t.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const monthLabel = t.toLocaleDateString('es-UY', { month: 'long', year: 'numeric' });

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));

  return (
    <section className="screen active">
      <div className="pool-board">
        <div className="pool-label">Fondo compartido</div>
        <div className="pool-value">{total}</div>
        <div className="pool-sub">Suma lo cumplido, resta lo que quedó pendiente</div>
      </div>

      <div className="today-row">
        {users.map((u) => {
          const val = todayFor(u.id, habitLogs);
          const pct = Math.min(100, Math.round((val / 15) * 100));
          return (
            <div className="today-card" key={u.id}>
              <div className="name">{u.name} · hoy</div>
              <div className="amount">{val} pts</div>
              <div className="bar-track"><div className="bar-fill" style={{ width: pct + '%' }} /></div>
            </div>
          );
        })}
      </div>

      <div className="section-head"><span className="cal-title">{monthLabel}</span></div>
      <div className="cal-card">
        <div className="cal-grid">
          {CAL_DOW_LABELS.map((l) => (
            <div className="cal-dow" key={l}>{l}</div>
          ))}
          {cells.map((d, i) =>
            d ? (
              <div key={i} className={'cal-day ' + dayAggregateStatus(habits, d, currentUser.id, habitLogs)}>
                {d.getDate()}
              </div>
            ) : (
              <div key={i} className="cal-day blank" />
            )
          )}
        </div>
        <div className="cal-legend">
          <span><i style={{ background: 'var(--green-soft)' }} />Cumplido</span>
          <span><i style={{ background: 'var(--amber-soft)' }} />Parcial</span>
          <span><i style={{ background: 'var(--coral-soft)' }} />No cumplido</span>
          <span><i style={{ border: '2px solid var(--amber)' }} />Hoy pendiente</span>
          <span><i style={{ border: '1px dashed var(--line)' }} />Sin hábito</span>
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
