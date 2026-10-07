import { userKey } from '../lib/theme';

export default function ProfileGate({ users, onPick }) {
  return (
    <div className="gate">
      <div className="gate-card">
        <div className="brand-mark" style={{ margin: '0 auto 14px' }}>↑</div>
        <h1 className="display" style={{ fontSize: 20, marginBottom: 4 }}>Arriba!</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
          ¿Quién sos?
        </p>
        <div className="gate-options">
          {users.map((u) => (
            <button key={u.id} data-user={userKey(users, u.id)} className="btn btn-primary btn-user" style={{ width: '100%' }} onClick={() => onPick(u)}>
              {u.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
