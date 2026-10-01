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

function RewardCard({ reward, total, isAdmin, actions, currentUser }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(reward.name);
  const [desc, setDesc] = useState(reward.description || '');
  const [cost, setCost] = useState(reward.cost_points);
  const [emoji, setEmoji] = useState(reward.emoji);

  function save() {
    actions.updateReward(reward.id, {
      name: name.trim() || reward.name,
      description: desc.trim(),
      cost_points: Number(cost) || reward.cost_points,
      emoji: emoji || reward.emoji
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="reward-card">
        <div className="field-row cols-2">
          <input value={emoji} maxLength={2} onChange={(e) => setEmoji(e.target.value)} />
          <input type="number" min="1" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <div className="field-row"><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field-row"><input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>Guardar</button>
          <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="reward-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="reward-emoji">{reward.emoji}</div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="rm" style={{ color: 'var(--court-light)' }} onClick={() => setEditing(true)}>✎</button>
            <button className="rm" onClick={() => window.confirm(`¿Eliminar "${reward.name}"?`) && actions.deleteReward(reward.id)}>✕</button>
          </div>
        )}
      </div>
      <div className="reward-name">{reward.name}</div>
      <div className="reward-desc">{reward.description}</div>
      <div className="reward-cost">{reward.cost_points} pts</div>
      <button
        className={'btn ' + (total >= reward.cost_points ? 'btn-primary' : 'btn-ghost')}
        disabled={total < reward.cost_points}
        onClick={() => actions.redeem(reward, currentUser.id)}
      >
        {total >= reward.cost_points ? 'Canjear' : 'Puntos insuficientes'}
      </button>
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
          <RewardCard key={r.id} reward={r} total={total} isAdmin={isAdmin} actions={actions} currentUser={currentUser} />
        ))}
      </div>
      {isAdmin && <RewardAdminForm onAdd={actions.addReward} />}
    </section>
  );
}
