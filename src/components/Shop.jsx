import { useState } from 'react';
import { pool } from '../lib/logic';

function RewardAdminForm({ onAdd }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [cost, setCost] = useState(30);
  const [emoji, setEmoji] = useState('🎁');

  function submit() {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), description: desc.trim(), cost_points: Number(cost) || 1, emoji: emoji || '🎁' });
    setName('');
    setDesc('');
  }

  return (
    <div className="admin-panel">
      <label className="flabel">Nueva recompensa</label>
      <div className="field-row"><input placeholder="Nombre, ej: Noche de películas" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field-row"><input placeholder="Descripción breve" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
      <div className="field-row cols-2">
        <input type="number" min="1" placeholder="Costo en puntos" value={cost} onChange={(e) => setCost(e.target.value)} />
        <input maxLength={2} placeholder="Emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
      </div>
      <button className="btn btn-primary" onClick={submit}>Crear recompensa</button>
    </div>
  );
}

export default function Shop({ rewards, habitLogs, redemptions, currentUser, isAdmin, actions }) {
  const total = pool(habitLogs, redemptions);
  const sorted = [...rewards].sort((a, b) => a.cost_points - b.cost_points);

  return (
    <section className="screen active">
      <h2 className="section-title">Tienda de recompensas</h2>
      <div className="reward-grid">
        {sorted.map((r) => (
          <div className="reward-card" key={r.id}>
            <div className="reward-emoji">{r.emoji}</div>
            <div className="reward-name">{r.name}</div>
            <div className="reward-desc">{r.description}</div>
            <div className="reward-cost">{r.cost_points} pts</div>
            <button
              className={'btn ' + (total >= r.cost_points ? 'btn-primary' : 'btn-ghost')}
              disabled={total < r.cost_points}
              onClick={() => actions.redeem(r, currentUser.id)}
            >
              {total >= r.cost_points ? 'Canjear' : 'Puntos insuficientes'}
            </button>
          </div>
        ))}
      </div>
      {isAdmin && <RewardAdminForm onAdd={actions.addReward} />}
    </section>
  );
}
