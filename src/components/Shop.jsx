import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  SCOPE, Q4_CATALOG, parseReward, encodeScope,
  individualBalance, poolBalance
} from '../lib/logic';
import { showPoints } from '../lib/pointsFx';
import '../theme-q4.css';

// Historial completo (no solo el mes en curso) para que los saldos sean reales.
function useEconomy(deps) {
  const [data, setData] = useState(null);
  const refresh = useCallback(async () => {
    const [u, h, hl, bl, rd, rw, tp] = await Promise.all([
      supabase.from('users').select('id,name').order('created_at'),
      supabase.from('habits').select('id,shared,points'),
      supabase.from('habit_logs').select('habit_id,user_id,log_date,points'),
      supabase.from('bonus_logs').select('user_id,points'),
      supabase.from('redemptions').select('reward_id,redeemed_by,points_spent'),
      supabase.from('rewards').select('*'),
      supabase.from('training_points').select('user_id,points')
    ]);
    const err = [u, h, hl, bl, rd, rw].find((r) => r.error);
    if (err) { console.error(err.error); return null; }
    const next = {
      users: u.data || [], habits: h.data || [], habitLogs: hl.data || [],
      bonusLogs: [...(bl.data || []), ...(tp.data || [])], redemptions: rd.data || [], rewards: rw.data || []
    };
    setData(next);
    return next;
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refresh(); }, [refresh, ...deps]);
  return [data, refresh];
}

function RewardCreateForm({ onAdd }) {
  const [kind, setKind] = useState('normal');
  const [scope, setScope] = useState(SCOPE.INDIVIDUAL);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [cost, setCost] = useState(450);
  const [emoji, setEmoji] = useState('🎁');
  const [multValue, setMultValue] = useState(2);
  const [multHours, setMultHours] = useState(24);

  function submit() {
    if (!name.trim()) return;
    const reward = {
      name: name.trim(),
      description: encodeScope(desc.trim(), scope),
      cost_points: Number(cost) || 1,
      emoji: emoji || '🎁',
      kind
    };
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
        <button type="button" className={scope === SCOPE.INDIVIDUAL ? 'sel' : ''} onClick={() => setScope(SCOPE.INDIVIDUAL)}>Individual</button>
        <button type="button" className={scope === SCOPE.SHARED ? 'sel' : ''} onClick={() => setScope(SCOPE.SHARED)}>Pozo Común</button>
      </div>
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

function RewardCard({ reward, balance, isAdmin, actions, onRedeem, busy }) {
  const { scope, description } = parseReward(reward);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(reward.name);
  const [desc, setDesc] = useState(description);
  const [cost, setCost] = useState(reward.cost_points);
  const [emoji, setEmoji] = useState(reward.emoji);
  const [sc, setSc] = useState(scope);
  const [multValue, setMultValue] = useState(reward.multiplier_value || 2);
  const [multHours, setMultHours] = useState(reward.multiplier_hours || 24);

  const enough = balance >= reward.cost_points;
  const missing = Math.max(0, reward.cost_points - balance);
  const pct = Math.min(100, Math.round((Math.max(0, balance) / reward.cost_points) * 100));

  function save() {
    const patch = {
      name: name.trim() || reward.name,
      description: encodeScope(desc.trim(), sc),
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
        <div className="kind-toggle">
          <button type="button" className={sc === SCOPE.INDIVIDUAL ? 'sel' : ''} onClick={() => setSc(SCOPE.INDIVIDUAL)}>Individual</button>
          <button type="button" className={sc === SCOPE.SHARED ? 'sel' : ''} onClick={() => setSc(SCOPE.SHARED)}>Pozo</button>
        </div>
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
    <div className={'reward-card ' + (scope === SCOPE.SHARED ? 'is-shared' : 'is-individual')}>
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
      <div className="reward-desc">{description}</div>
      <div className="reward-cost">{reward.cost_points.toLocaleString('es-UY')} pts</div>
      {!enough && (
        <div>
          <div className="bar-track"><div className="bar-fill" style={{ width: pct + '%' }} /></div>
          <div className="hmeta" style={{ marginTop: 4 }}>Faltan {missing.toLocaleString('es-UY')} pts</div>
        </div>
      )}
      <button
        className={'btn ' + (enough ? 'btn-primary' : 'btn-ghost')}
        disabled={!enough || busy}
        onClick={() => onRedeem(reward, scope)}
      >
        {enough ? 'Canjear' : 'Puntos insuficientes'}
      </button>
    </div>
  );
}

export default function Shop({ rewards, habitLogs, bonusLogs, redemptions, currentUser, isAdmin, actions }) {
  const [eco, refresh] = useEconomy([habitLogs, bonusLogs, redemptions, rewards]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const data = eco || { users: [], habits: [], habitLogs, bonusLogs, redemptions, rewards };
  const mine = individualBalance(currentUser.id, data.habitLogs, data.bonusLogs, data.redemptions, data.rewards);
  const shared = poolBalance(data);

  const visible = rewards.map((r) => ({ r, ...parseReward(r) })).sort((a, b) => a.r.cost_points - b.r.cost_points);
  const individuals = visible.filter((x) => x.scope === SCOPE.INDIVIDUAL);
  const commons = visible.filter((x) => x.scope === SCOPE.SHARED);

  async function handleRedeem(reward, scope) {
    if (busy) return;
    setBusy(true);
    setMsg('');
    try {
      // Re-verificar contra datos frescos justo antes de canjear.
      const fresh = (await refresh()) || data;
      const balance = scope === SCOPE.SHARED
        ? poolBalance(fresh)
        : individualBalance(currentUser.id, fresh.habitLogs, fresh.bonusLogs, fresh.redemptions, fresh.rewards);
      if (balance < reward.cost_points) {
        setMsg(scope === SCOPE.SHARED ? 'El Pozo Común no alcanza.' : 'Tu saldo individual no alcanza.');
        return;
      }
      const from = scope === SCOPE.SHARED ? 'del Pozo Común' : 'de tu saldo individual';
      if (!window.confirm(`¿Canjear "${reward.name}" por ${reward.cost_points} pts ${from}?`)) return;
      await actions.redeem(reward, currentUser.id);
      await refresh();
      setMsg(`Canjeado: ${reward.name} ✓`);
      showPoints(-reward.cost_points, reward.name);
    } finally {
      setBusy(false);
    }
  }

  async function loadQ4Catalog() {
    if (!window.confirm('¿Cargar/actualizar el catálogo Q4 (precios y tipo Individual/Pozo)?')) return;
    const norm = (s) => (s || '').toLowerCase().trim();
    for (const c of Q4_CATALOG) {
      const existing = rewards.find((r) => norm(r.name) === norm(c.name));
      const payload = {
        name: c.name, emoji: c.emoji, cost_points: c.cost,
        description: encodeScope(c.description, c.scope)
      };
      if (existing) await actions.updateReward(existing.id, payload);
      else await actions.addReward({ ...payload, kind: 'normal' });
    }
    refresh();
  }

  return (
    <section className="screen active">
      <h2 className="section-title">Tienda de recompensas</h2>

      <div className="wallets">
        <div className="wallet wallet-me">
          <div className="wallet-label">Tu saldo · {currentUser.name}</div>
          <div className="wallet-value">{mine.toLocaleString('es-UY')}</div>
        </div>
        <div className="wallet wallet-pool">
          <div className="wallet-label">Pozo Común</div>
          <div className="wallet-value">{shared.toLocaleString('es-UY')}</div>
        </div>
      </div>
      {msg && <div className="shop-msg">{msg}</div>}

      <h3 className="shop-sub">Uso individual <span className="tag tag-ind">Puntos individuales</span></h3>
      <div className="reward-grid">
        {individuals.map(({ r }) => (
          <RewardCard key={r.id} reward={r} balance={mine} isAdmin={isAdmin} actions={actions} onRedeem={handleRedeem} busy={busy} />
        ))}
      </div>
      {!individuals.length && <div className="empty">Sin recompensas individuales.</div>}

      <h3 className="shop-sub">Pozo Común <span className="tag tag-pool">Puntos compartidos</span></h3>
      <div className="reward-grid">
        {commons.map(({ r }) => (
          <RewardCard key={r.id} reward={r} balance={shared} isAdmin={isAdmin} actions={actions} onRedeem={handleRedeem} busy={busy} />
        ))}
      </div>
      {!commons.length && <div className="empty">Sin recompensas de Pozo Común.</div>}

      {isAdmin && (
        <>
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 16 }} onClick={loadQ4Catalog}>
            Cargar catálogo Q4
          </button>
          <RewardCreateForm onAdd={actions.addReward} />
        </>
      )}
    </section>
  );
}
