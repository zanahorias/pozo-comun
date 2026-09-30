const TABS = [
  { id: 'board', icon: '🏠', label: 'Tablero' },
  { id: 'habits', icon: '✅', label: 'Hábitos' },
  { id: 'training', icon: '💪', label: 'Entreno' },
  { id: 'shop', icon: '🎁', label: 'Tienda' }
];

export default function TabBar({ screen, onChange }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button key={t.id} className={screen === t.id ? 'active' : ''} onClick={() => onChange(t.id)}>
          <span className="ico">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
