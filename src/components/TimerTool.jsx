import { useEffect, useRef, useState } from 'react';

function formatMs(ms) {
  const total = Math.max(0, Math.round(ms / 100)) * 100;
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const t = Math.floor((total % 1000) / 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${t}`;
}

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    // Si el navegador bloquea audio sin interacción previa, no pasa nada grave.
  }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

function Stopwatch() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startRef = useRef(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setElapsed(Date.now() - startRef.current);
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  function start() {
    startRef.current = Date.now() - elapsed;
    setRunning(true);
  }
  function pause() {
    setRunning(false);
  }
  function reset() {
    setRunning(false);
    setElapsed(0);
  }

  return (
    <div className="timer-box">
      <div className="timer-display">{formatMs(elapsed)}</div>
      <div className="timer-controls">
        {!running ? (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={start}>{elapsed > 0 ? 'Reanudar' : 'Iniciar'}</button>
        ) : (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={pause}>Pausar</button>
        )}
        <button className="btn btn-ghost" onClick={reset}>Reiniciar</button>
      </div>
    </div>
  );
}

function Countdown() {
  const [minutes, setMinutes] = useState(1);
  const [seconds, setSeconds] = useState(0);
  const [remaining, setRemaining] = useState(null); // ms restantes, null = sin iniciar
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const left = endRef.current - Date.now();
      if (left <= 0) {
        setRemaining(0);
        setRunning(false);
        setDone(true);
        beep();
        clearInterval(id);
      } else {
        setRemaining(left);
      }
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  function start() {
    const base = remaining ?? (Number(minutes) * 60 + Number(seconds)) * 1000;
    if (base <= 0) return;
    endRef.current = Date.now() + base;
    setRemaining(base);
    setRunning(true);
    setDone(false);
  }
  function pause() {
    setRunning(false);
  }
  function reset() {
    setRunning(false);
    setRemaining(null);
    setDone(false);
  }

  const display = remaining === null ? (Number(minutes) * 60 + Number(seconds)) * 1000 : remaining;

  return (
    <div className="timer-box">
      {remaining === null && (
        <div className="field-row cols-2" style={{ marginBottom: 10 }}>
          <div><label className="flabel">Minutos</label><input type="number" min="0" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></div>
          <div><label className="flabel">Segundos</label><input type="number" min="0" max="59" value={seconds} onChange={(e) => setSeconds(e.target.value)} /></div>
        </div>
      )}
      <div className={'timer-display' + (done ? ' timer-done' : '')}>{formatMs(display)}</div>
      {done && <div className="hmeta" style={{ textAlign: 'center', marginBottom: 8 }}>¡Tiempo cumplido!</div>}
      <div className="timer-controls">
        {!running ? (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={start}>{remaining ? 'Reanudar' : 'Iniciar'}</button>
        ) : (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={pause}>Pausar</button>
        )}
        <button className="btn btn-ghost" onClick={reset}>Reiniciar</button>
      </div>
    </div>
  );
}

export default function TimerTool() {
  const [mode, setMode] = useState('stopwatch');
  return (
    <div>
      <div className="kind-toggle">
        <button type="button" className={mode === 'stopwatch' ? 'sel' : ''} onClick={() => setMode('stopwatch')}>Cronómetro</button>
        <button type="button" className={mode === 'countdown' ? 'sel' : ''} onClick={() => setMode('countdown')}>Temporizador</button>
      </div>
      {mode === 'stopwatch' ? <Stopwatch /> : <Countdown />}
    </div>
  );
}
