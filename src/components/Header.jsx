export default function Header({ users, currentUser, onSwitchUser, isAdmin }) {
  return (
    <header className="top">
      <div className="brand">
        <div className="brand-mark">PC</div>
        <div className="brand-name">Pozo Común</div>
      </div>
      <div className="top-controls">
        <div className="switcher">
          {users.map((u) => (
            <button
              key={u.id}
              className={u.id === currentUser.id ? 'active' : ''}
              onClick={() => onSwitchUser(u)}
            >
              {u.name}
            </button>
          ))}
        </div>
        {isAdmin && <span className="admin-chip on"><span>Admin</span></span>}
      </div>
    </header>
  );
}
