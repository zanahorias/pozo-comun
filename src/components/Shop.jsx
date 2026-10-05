import { useState } from 'react';
import { pool } from '../lib/logic';

function RewardCreateForm({ onAdd }) {
  const [kind, setKind] = useState('normal');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [cost, setCost] = useState(30);
  const [emoji, setEmoji] = useState('🎁');
  const [multValue, setMultValue] = useState(2);
  const [multHours, setMultHours] = useState(24);

  function submit() {
    if (!name.trim()) return;
    const reward = { name: name.trim(), description: desc.trim(), cost_points: Number(cost) || 1, emoji: emoji || '🎁', kind };
    if (kind === 'multiplier') {
      reward.multiplier_value = Number(multValue) || 2;
      reward.multiplier_hours = Number(multHours) || 24;
    }
    onAdd(reward);
    setName('');
    setDesc('');
  }

  return (
    <div className="admin-panel">
      <label className="flabel">Nueva recompensa</label>
      <div className="kind-toggle">
        <button type="button" className={kind === 'normal' ? 'sel' : ''} onClick={() => setKind('normal')}>Normal</button>
        <button type="button" className={kind === 'multiplier' ? 'sel' : ''} onClick={() => setKind('multiplier')}>Multiplicador</button>
      </div>
      <div className="field-row"><input placeholder="Nombre, ej: Noche de películas" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field-row"><input placeholder="Descripción breve" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
      <div className="field-row cols-2">
        <input type="number" min="1" placeholder="Costo en puntos" value={cost} onChange={(e) => setCost(e.target.value)} />
        <input maxLength={2} placeholder="Emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
      </div>
      {kind === 'multiplier' && (
        <div className="field-row cols-2">
          <div><label className="flabel">Multiplicador</label><input type="number" min="1.1" step="0.1" value={multValue} onChange={(e) => setMultValue(e.target.value)} /></div>
          <div><label className="flabel">Duración (hs)</label><input type="number" min="1" value={multHours} onChange={(e) => setMultHours(e.target.value)} /></div>
        </div>
      )}
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
  const [multValue, setMultValue] = useState(reward.multiplier_value || 2);
  const [multHours, setMultHours] = useState(reward.multiplier_hours || 24);

  function save() {
    const patch = {
      name: name.trim() || reward.name,
      description: desc.trim(),
      cost_points: Number(cost) || reward.cost_points,
      emoji: emoji || reward.emoji
    };
    if (reward.kind === 'multiplier') {
      patch.multiplier_value = Number(multValue) || reward.multiplier_value;
      patch.multiplier_hours = Number(multHours) || reward.multiplier_hours;
    }
    actions.updateReward(reward.id, patch);
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
        {reward.kind === 'multiplier' && (
          <div className="field-row cols-2">
            <input type="number" min="1.1" step="0.1" value={multValue} onChange={(e) => setMultValue(e.target.value)} />
            <input type="number" min="1" value={multHours} onChange={(e) => setMultHours(e.target.value)} />
          </div>
        )}
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
      {reward.kind === 'multiplier' && (
        <div className="reward-badge">✨ x{reward.multiplier_value} por {reward.multiplier_hours}hs</div>
      )}
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

export default function Shop({ rewards, habitLogs, bonusLogs, redemptions, currentUser, isAdmin, actions }) {
  const total = pool(habitLogs, redemptions, bonusLogs);
  const sorted = [...rewards].sort((a, b) => a.cost_points - b.cost_points);

  return (
    <section className="screen active">
      <h2 className="section-title">Tienda de recompensas</h2>
      <div className="reward-grid">
        {sorted.map((r) => (
          <RewardCard key={r.id} reward={r} total={total} isAdmin={isAdmin} actions={actions} currentUser={currentUser} />
        ))}
      </div>
      {isAdmin && <RewardCreateForm onAdd={actions.addReward} />}
    </section>
  );
}
