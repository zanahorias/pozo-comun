import { useEffect, useState } from 'react';
import { useAppData } from './hooks/useAppData';
import ProfileGate from './components/ProfileGate';
import Header from './components/Header';
import Board from './components/Board';
import Habits from './components/Habits';
import Training from './components/Training';
import Shop from './components/Shop';
import TabBar from './components/TabBar';

const PROFILE_KEY = 'pozo-comun-profile-id';

export default function App() {
  const { users, habits, habitLogs, workouts, rewards, redemptions, trackingStartDate, loading, error, actions, fetchMonthLogs } = useAppData();
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem(PROFILE_KEY));
  const [screen, setScreen] = useState('board');

  useEffect(() => {
    if (currentUserId) localStorage.setItem(PROFILE_KEY, currentUserId);
  }, [currentUserId]);

  if (loading) {
    return <div className="empty" style={{ paddingTop: 80 }}>Cargando…</div>;
  }

  if (error) {
    return (
      <div className="empty" style={{ paddingTop: 80 }}>
        No se pudo conectar con la base de datos.<br />
        Revisá tu archivo .env con los datos de Supabase.<br />
        <span style={{ fontSize: 11 }}>{error}</span>
      </div>
    );
  }

  const currentUser = users.find((u) => u.id === currentUserId);
  if (!currentUser) {
    return <ProfileGate users={users} onPick={(u) => setCurrentUserId(u.id)} />;
  }

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="app">
      <Header users={users} currentUser={currentUser} onSwitchUser={(u) => setCurrentUserId(u.id)} isAdmin={isAdmin} />
      <main>
        {screen === 'board' && (
          <Board users={users} habits={habits} habitLogs={habitLogs} workouts={workouts} rewards={rewards} redemptions={redemptions} currentUser={currentUser} trackingStartDate={trackingStartDate} fetchMonthLogs={fetchMonthLogs} />
        )}
        {screen === 'habits' && (
          <Habits habits={habits} habitLogs={habitLogs} currentUser={currentUser} isAdmin={isAdmin} actions={actions} trackingStartDate={trackingStartDate} />
        )}
        {screen === 'training' && (
          <Training users={users} currentUser={currentUser} workouts={workouts} actions={actions} />
        )}
        {screen === 'shop' && (
          <Shop rewards={rewards} habitLogs={habitLogs} redemptions={redemptions} currentUser={currentUser} isAdmin={isAdmin} actions={actions} />
        )}
      </main>
      <TabBar screen={screen} onChange={setScreen} />
    </div>
  );
}
