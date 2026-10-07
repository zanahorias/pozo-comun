import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  SCOPE, Q4_CATALOG, MAX_STOCK, parseReward, encodeScope,
  individualBalance, poolBalance, jokerState
} from '../lib/logic';
import { showPoints } from '../lib/pointsFx';
import '../theme-q4.css';

// Historial completo (no solo el mes en curso) para que los saldos sean reales.
function useEconomy(deps) {
  const [data, setData] = useState(null);
  const refresh = useCallback(async () => {
    const [u, h, hl, bl, rd, rw, tp, us] = await Promise.all([
      supabase.from('users').select('id,name').order('created_at'),
      supabase.from('habits').select('id,shared,points'),
      supabase.from('habit_logs').select('habit_id,user_id,log_date,points'),
      supabase.from('bonus_logs').select('user_id,points'),
      supabase.from('redemptions').select('id,reward_id,redeemed_by,points_spent,created_at'),
      supabase.from('rewards').select('*'),
      supabase.from('training_points').select('user_id,points'),
      supabase.from('redemption_uses').select('redemption_id,user_id,used_at')
    ]);
    const err = [u, h, hl, bl, rd, rw].find((r) => r.error);
    if (err) { console.error(err.error); return null; }
    const next = {
      users: u.data || [], habits: h.data || [], habitLogs: hl.data || [],
      bonusLogs: [...(bl.data || []), ...(tp.data || [])], redemptions: rd.data || [], rewards: rw.data || [], uses: us.data || []
    };
    setData(next);
    return next;
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refresh(); }, [refresh, ...deps]);
  // Si el otro usa un canje (o un comodín), se actualiza solo para los dos.
  useEffect(() => {
    const ch = supabase.channel('shop-uses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'redemption_uses' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'redemptions' }, refresh)
      .subscribe();
    const poll = setInterval(refresh, 15000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [refresh]);
  return [data, refresh];
}

// Canjes guardados sin usar + comodines de descanso disponibles de un usuario.
function computeOwned(d, uid) {
  const rewardById = (id) => d.rewards.find((r) => r.id === id);
  const used = new Set((d.uses || []).map((x) => x.redemption_id));
  const zeroLogs = d.habitLogs.filter((e) => e.user_id === uid && e.points === 0).length;
  const jokers = jokerState(d.rewards, d.redemptions, d.uses, uid, zeroLogs).available;
  const vouchers = d.redemptions
    .map((r) => ({ r, rw: rewardById(r.reward_id) }))
    .filter(({ r, rw }) => {
      if (!rw || used.has(r.id)) return false;
      const p = parseReward(rw);
      if (p.isJoker) return false;
      return p.scope === SCOPE.SHARED || r.redeemed_by === uid;
    })
    .map(({ r, rw }) => ({ r, rw, ...parseReward(rw) }))
    .sort((a, b) => new Date(b.r.created_at) - new Date(a.r.created_at));
  const ownedOf = (reward) => (parseReward(reward).isJoker ? jokers : vouchers.filter((v) => v.rw.id === reward.id).length);
  return { jokers, vouchers, ownedOf };
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

function RewardCard({ reward, balance, owned, isAdmin, actions, onRedeem, busy }) {
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
  const capped = owned >= MAX_STOCK;
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
      {owned > 0 && <div className="owned-badge">✓ Ya tenés {owned} disponible{owned > 1 ? 's' : ''}</div>}
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
        className={'btn ' + (enough && !capped ? 'btn-primary' : 'btn-ghost')}
        disabled={!enough || capped || busy}
        onClick={() => onRedeem(reward, scope)}
      >
        {capped ? 'Ya tenés uno · usalo primero' : enough ? 'Canjear y guardar' : 'Puntos insuficientes'}
      </button>
    </div>
  );
}

export default function Shop({ rewards, habitLogs, bonusLogs, redemptions, currentUser, isAdmin, actions }) {
  const [eco, refresh] = useEconomy([habitLogs, bonusLogs, redemptions, rewards]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('shop');

  const data = eco || { users: [], habits: [], habitLogs, bonusLogs, redemptions, rewards, uses: [] };
  const mine = individualBalance(currentUser.id, data.habitLogs, data.bonusLogs, data.redemptions, data.rewards);
  const shared = poolBalance(data);
  const owned = computeOwned(data, currentUser.id);
  const inventoryCount = owned.jokers + owned.vouchers.length;

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
      if (computeOwned(fresh, currentUser.id).ownedOf(reward) >= MAX_STOCK) {
        setMsg('Ya tenés uno disponible de esto. Usalo antes de canjear otro.');
        return;
      }
      const from = scope === SCOPE.SHARED ? 'del Pozo Común' : 'de tu saldo individual';
      if (!window.confirm(`¿Canjear "${reward.name}" por ${reward.cost_points} pts ${from}?`)) return;
      await actions.redeem(reward, currentUser.id);
      await refresh();
      setMsg(`Guardado en Mis comodines: ${reward.name} 🎟️ (usalo cuando quieras)`);
      showPoints(-reward.cost_points, reward.name);
    } finally {
      setBusy(false);
    }
  }

  // Usar un canje guardado (los multiplicadores se activan recién ahora).
  async function useVoucher(v) {
    if (busy) return;
    if (!window.confirm(`¿Usar "${v.rw.name}" ahora?`)) return;
    setBusy(true);
    setMsg('');
    try {
      const { error } = await supabase.from('redemption_uses').insert([{ redemption_id: v.r.id, user_id: currentUser.id }]);
      if (error) {
        await refresh();
        setMsg(error.code === '23505' ? 'Ese canje ya fue usado.' : 'No se pudo usar: ' + error.message);
        return;
      }
      if (v.rw.kind === 'multiplier' && v.rw.multiplier_value) {
        const expiresAt = new Date(Date.now() + (v.rw.multiplier_hours || 24) * 3600 * 1000).toISOString();
        await supabase.from('active_multipliers').insert([{ multiplier: v.rw.multiplier_value, source: v.rw.name, expires_at: expiresAt }]);
      }
      await refresh();
      setMsg(`Usaste: ${v.rw.name} ✓`);
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
      <div className="subtabs">
        <button className={tab === 'shop' ? 'active' : ''} onClick={() => setTab('shop')}>🛍️ Tienda</button>
        <button className={tab === 'inv' ? 'active' : ''} onClick={() => setTab('inv')}>🎟️ Mis comodines{inventoryCount ? ` (${inventoryCount})` : ''}</button>
      </div>
      {msg && <div className="shop-msg">{msg}</div>}

      {tab === 'inv' && (
        <div>
          {owned.jokers > 0 && (
            <div className="log-card voucher is-individual">
              <div className="lhead"><span className="lname">🃏 Comodín de descanso × {owned.jokers}</span><span className="tag tag-ind">Individual</span></div>
              <div className="hmeta" style={{ margin: '4px 0 6px' }}>Se usa desde Hábitos (botón 🃏) para saltar un hábito sin perder la racha.</div>
            </div>
          )}
          {owned.vouchers.map((v) => (
            <div className={'log-card voucher ' + (v.scope === SCOPE.SHARED ? 'is-shared' : 'is-individual')} key={v.r.id}>
              <div className="lhead">
                <span className="lname">{v.rw.emoji} {v.rw.name}</span>
                <span className={'tag ' + (v.scope === SCOPE.SHARED ? 'tag-pool' : 'tag-ind')}>{v.scope === SCOPE.SHARED ? 'Pozo' : 'Individual'}</span>
              </div>
              <div className="hmeta" style={{ margin: '4px 0 8px' }}>
                {v.description}{v.rw.kind === 'multiplier' ? ` · activa x${v.rw.multiplier_value} por ${v.rw.multiplier_hours}hs` : ''}
                <br />Canjeado el {new Date(v.r.created_at).toLocaleDateString('es-UY', { day: '2-digit', month: 'short' })} por {data.users.find((x) => x.id === v.r.redeemed_by)?.name || '—'}
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy} onClick={() => useVoucher(v)}>Usar ahora</button>
            </div>
          ))}
          {!inventoryCount && <div className="empty">Todavía no tenés nada guardado. Canjeá algo en la tienda y usalo cuando quieras.</div>}
        </div>
      )}

      {tab === 'shop' && (<>
      <h3 className="shop-sub">Uso individual <span className="tag tag-ind">Puntos individuales</span></h3>
      <div className="reward-grid">
        {individuals.map(({ r }) => (
          <RewardCard key={r.id} reward={r} balance={mine} owned={owned.ownedOf(r)} isAdmin={isAdmin} actions={actions} onRedeem={handleRedeem} busy={busy} />
        ))}
      </div>
      {!individuals.length && <div className="empty">Sin recompensas individuales.</div>}

      <h3 className="shop-sub">Pozo Común <span className="tag tag-pool">Puntos compartidos</span></h3>
      <div className="reward-grid">
        {commons.map(({ r }) => (
          <RewardCard key={r.id} reward={r} balance={shared} owned={owned.ownedOf(r)} isAdmin={isAdmin} actions={actions} onRedeem={handleRedeem} busy={busy} />
        ))}
      </div>
      {!commons.length && <div className="empty">Sin recompensas de Pozo Común.</div>}

      </>)}

      {isAdmin && tab === 'shop' && (
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
