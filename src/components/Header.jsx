import { userKey } from '../lib/theme';

export default function Header({ users, currentUser, onSwitchUser, isAdmin, onToggleAdmin, userTotals, poolTotal }) {
  return (
    <header className="top">
      <div className="brand">
        <div className="brand-mark">↑</div>
        <div className="brand-name">Arriba!</div>
      </div>
      <div className="top-controls">
        <div className="switcher">
          {users.map((u) => (
            <button
              key={u.id}
              data-user={userKey(users, u.id)}
              className={u.id === currentUser.id ? 'active' : ''}
              onClick={() => onSwitchUser(u)}
            >
              {u.name}
              <span className="switcher-total">{userTotals?.[u.id] ?? 0}</span>
            </button>
          ))}
          {poolTotal !== undefined && (
            <span className="switcher-pool" title="Pozo Común">
              🤝 Pozo <span className="switcher-total">{poolTotal}</span>
            </span>
          )}
        </div>
        <button className={'admin-chip' + (isAdmin ? ' on' : '')} onClick={onToggleAdmin}>
          <span>{isAdmin ? 'Admin ✓' : 'Admin'}</span>
        </button>
      </div>
    </header>
  );
}
