import { useEffect, useRef, useState } from 'react';
import { showPoints, subscribePoints } from '../lib/pointsFx';
import '../theme-q4.css';

// Muestra un puntaje flotante cada vez que cambia el total del usuario
// (hábitos, ejercicios, bonos, penalidades) o cuando alguien llama showPoints().
export default function PointsFx({ userId, total }) {
  const [items, setItems] = useState([]);
  const prev = useRef(null);
  const armedAt = useRef(0);

  useEffect(() => { prev.current = null; armedAt.current = 0; }, [userId]);

  useEffect(() => {
    if (typeof total !== 'number') return;
    if (prev.current === null) {
      prev.current = total;
      armedAt.current = Date.now() + 3000; // ignora ajustes de la carga inicial
      return;
    }
    const delta = total - prev.current;
    prev.current = total;
    if (delta && Date.now() > armedAt.current) showPoints(delta);
  }, [total]);

  useEffect(() => {
    return subscribePoints((delta, label) => {
      const id = Math.random().toString(36).slice(2);
      setItems((l) => [...l.slice(-3), { id, delta, label }]);
      setTimeout(() => setItems((l) => l.filter((i) => i.id !== id)), 1900);
    });
  }, []);

  return (
    <div className="points-fx" aria-live="polite">
      {items.map((i) => (
        <div key={i.id} className={'points-pop ' + (i.delta > 0 ? 'plus' : 'minus')}>
          {i.delta > 0 ? '+' : '−'}{Math.abs(i.delta)}
          {i.label && <small>{i.label}</small>}
        </div>
      ))}
    </div>
  );
}
