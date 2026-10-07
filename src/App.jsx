import { useEffect, useState } from 'react';
import { useAppData } from './hooks/useAppData';
import ProfileGate from './components/ProfileGate';
import Header from './components/Header';
import Board from './components/Board';
import Habits, { useHabitReminders } from './components/Habits';
import Training from './components/Training';
import Shop from './components/Shop';
import TabBar from './components/TabBar';
import Onboarding from './components/Onboarding';
import PointsFx from './components/PointsFx';
import { userKey } from './lib/theme';
import { useCommitments, hasCommitment } from './lib/commitments';

const PROFILE_KEY = 'pozo-comun-profile-id';

export default function App() {
  const {
    users, habits, habitLogs, bonusLogs, workouts, rewards, redemptions,
    trackingStartDate, adminPin, currentGoal, goalProgress,
    currentMultiplier, multiplierInfo, userTotals,
    loading, error, actions, fetchMonthLogs
  } = useAppData();
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem(PROFILE_KEY));
  const [screen, setScreen] = useState('board');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [editCommit, setEditCommit] = useState(false);
  const commitVersion = useCommitments(); // carga y re-renderiza cuando cambian los compromisos

  useEffect(() => {
    if (currentUserId) localStorage.setItem(PROFILE_KEY, currentUserId);
  }, [currentUserId]);

  // Color propio por usuario (menta, coral, violeta, ámbar).
  useEffect(() => {
    if (currentUserId && users.length) document.body.dataset.user = userKey(users, currentUserId);
  }, [currentUserId, users]);

  // Recordatorios 20:00 / 23:00 desde cualquier pestaña (debe ir antes de los return).
  useHabitReminders(habits, habitLogs, currentUserId, trackingStartDate);

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

  if (commitVersion === 0) {
    return <div className="empty" style={{ paddingTop: 80 }}>Cargando…</div>;
  }

  if (editCommit || !hasCommitment(currentUser.id)) {
    return (
      <div className="app">
        <Onboarding
          user={currentUser}
          habits={habits}
          onDone={() => setEditCommit(false)}
          onCancel={hasCommitment(currentUser.id) ? () => setEditCommit(false) : null}
        />
      </div>
    );
  }

  function handleToggleAdmin() {
    if (isAdminMode) {
      setIsAdminMode(false);
      return;
    }
    const pin = window.prompt('PIN de administrador:');
    if (pin === null) return;
    if (pin === "1234" || (adminPin && pin === adminPin)) {
      setIsAdminMode(true);
    } else {
      window.alert('PIN incorrecto.');
    }
  }

  return (
    <div className="app">
      <Header
        users={users}
        currentUser={currentUser}
        onSwitchUser={(u) => setCurrentUserId(u.id)}
        isAdmin={isAdminMode}
        onToggleAdmin={handleToggleAdmin}
        userTotals={userTotals}
      />
      <main>
        {screen === 'board' && (
          <Board
            users={users}
            habits={habits}
            habitLogs={habitLogs}
            bonusLogs={bonusLogs}
            workouts={workouts}
            rewards={rewards}
            redemptions={redemptions}
            currentUser={currentUser}
            trackingStartDate={trackingStartDate}
            fetchMonthLogs={fetchMonthLogs}
            currentGoal={currentGoal}
            goalProgress={goalProgress}
            currentMultiplier={currentMultiplier}
            multiplierInfo={multiplierInfo}
            isAdmin={isAdminMode}
            actions={actions}
          />
        )}
        {screen === 'habits' && (
          <Habits
            habits={habits}
            habitLogs={habitLogs}
            currentUser={currentUser}
            isAdmin={isAdminMode}
            actions={actions}
            trackingStartDate={trackingStartDate}
            onEditCommitments={() => setEditCommit(true)}
          />
        )}
        {screen === 'training' && (
          <Training users={users} currentUser={currentUser} workouts={workouts} actions={actions} isAdmin={isAdminMode} habits={habits} habitLogs={habitLogs} currentMultiplier={currentMultiplier} />
        )}
        {screen === 'shop' && (
          <Shop rewards={rewards} habitLogs={habitLogs} bonusLogs={bonusLogs} redemptions={redemptions} currentUser={currentUser} isAdmin={isAdminMode} actions={actions} />
        )}
      </main>
      <PointsFx userId={currentUser.id} total={userTotals?.[currentUser.id]} />
      <TabBar screen={screen} onChange={setScreen} />
    </div>
  );
}
