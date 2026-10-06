// Pictogramas simples y originales (trazo tipo stick-figure) para cada
// ejercicio predeterminado. No son fotos: son ilustraciones propias en SVG,
// así no dependen de internet ni de imágenes de terceros.

const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};

function Head({ cx, cy }) {
  return <circle cx={cx} cy={cy} r="7" {...common} />;
}

const ICONS = {
  'Sentadilla': (
    <svg viewBox="0 0 100 100">
      <Head cx={50} cy={22} />
      <path d="M50 29 V50" {...common} />
      <path d="M50 50 L34 64 L34 80" {...common} />
      <path d="M50 50 L66 64 L66 80" {...common} />
      <path d="M38 40 H62" {...common} />
    </svg>
  ),
  'Press de banca': (
    <svg viewBox="0 0 100 100">
      <rect x="20" y="58" width="60" height="10" rx="3" {...common} />
      <Head cx={50} cy={40} />
      <path d="M50 47 V58" {...common} />
      <path d="M30 35 H70" {...common} />
      <circle cx="26" cy="35" r="5" {...common} />
      <circle cx="74" cy="35" r="5" {...common} />
    </svg>
  ),
  'Peso muerto': (
    <svg viewBox="0 0 100 100">
      <Head cx={50} cy={22} />
      <path d="M50 29 V48 L38 78" {...common} />
      <path d="M50 48 L62 78" {...common} />
      <path d="M38 78 H24" {...common} />
      <path d="M62 78 H76" {...common} />
      <circle cx="20" cy="78" r="6" {...common} />
      <circle cx="80" cy="78" r="6" {...common} />
      <path d="M38 50 L28 58" {...common} />
      <path d="M62 50 L72 58" {...common} />
    </svg>
  ),
  'Press militar': (
    <svg viewBox="0 0 100 100">
      <Head cx={50} cy={24} />
      <path d="M50 31 V68" {...common} />
      <path d="M38 82 L50 68 L62 82" {...common} />
      <path d="M50 38 L34 20" {...common} />
      <path d="M50 38 L66 20" {...common} />
      <path d="M26 16 H42" {...common} />
      <path d="M58 16 H74" {...common} />
    </svg>
  ),
  'Remo con barra': (
    <svg viewBox="0 0 100 100">
      <Head cx={34} cy={30} />
      <path d="M34 37 L30 60" {...common} />
      <path d="M30 60 L24 82" {...common} />
      <path d="M30 60 L50 70" {...common} />
      <path d="M30 44 L58 50" {...common} />
      <path d="M58 50 H78" {...common} />
      <circle cx="82" cy="50" r="5" {...common} />
    </svg>
  ),
  'Curl de bíceps': (
    <svg viewBox="0 0 100 100">
      <Head cx={50} cy={22} />
      <path d="M50 29 V70" {...common} />
      <path d="M38 84 L50 70 L62 84" {...common} />
      <path d="M38 40 L28 56" {...common} />
      <path d="M28 56 L38 68" {...common} />
      <path d="M62 40 L72 56" {...common} />
      <path d="M72 56 L62 68" {...common} />
      <circle cx="38" cy="68" r="4" {...common} />
      <circle cx="62" cy="68" r="4" {...common} />
    </svg>
  ),
  'Extensión de tríceps': (
    <svg viewBox="0 0 100 100">
      <Head cx={50} cy={22} />
      <path d="M50 29 V70" {...common} />
      <path d="M38 84 L50 70 L62 84" {...common} />
      <path d="M44 36 L44 56" {...common} />
      <path d="M44 56 L58 64" {...common} />
      <path d="M56 36 L56 56" {...common} />
      <circle cx="58" cy="64" r="4" {...common} />
    </svg>
  ),
  'Zancadas': (
    <svg viewBox="0 0 100 100">
      <Head cx={46} cy={20} />
      <path d="M46 27 V50" {...common} />
      <path d="M46 50 L28 62 L24 82" {...common} />
      <path d="M46 50 L66 70 L74 82" {...common} />
      <path d="M34 38 H58" {...common} />
    </svg>
  ),
  'Jalón al pecho': (
    <svg viewBox="0 0 100 100">
      <Head cx={50} cy={26} />
      <path d="M50 33 V72" {...common} />
      <path d="M38 86 L50 72 L62 86" {...common} />
      <path d="M50 42 L30 20" {...common} />
      <path d="M50 42 L70 20" {...common} />
      <path d="M22 14 H78" {...common} />
    </svg>
  ),
  'Elevación lateral': (
    <svg viewBox="0 0 100 100">
      <Head cx={50} cy={22} />
      <path d="M50 29 V70" {...common} />
      <path d="M38 84 L50 70 L62 84" {...common} />
      <path d="M50 40 L26 32" {...common} />
      <path d="M50 40 L74 32" {...common} />
      <circle cx="22" cy="32" r="4" {...common} />
      <circle cx="78" cy="32" r="4" {...common} />
    </svg>
  ),
  'Farmer Walk': (
    <svg viewBox="0 0 100 100">
      <Head cx={50} cy={18} />
      <path d="M50 25 V58" {...common} />
      <path d="M50 58 L40 86" {...common} />
      <path d="M50 58 L62 84" {...common} />
      <path d="M50 34 L32 56" {...common} />
      <path d="M50 34 L68 56" {...common} />
      <rect x="24" y="56" width="14" height="12" rx="3" {...common} />
      <rect x="62" y="56" width="14" height="12" rx="3" {...common} />
    </svg>
  ),
  'Caminata talones': (
    <svg viewBox="0 0 100 100">
      <Head cx={46} cy={16} />
      <path d="M46 23 V56" {...common} />
      <path d="M46 56 L36 80" {...common} />
      <path d="M46 56 L60 80" {...common} />
      <path d="M36 80 L28 72" {...common} />
      <path d="M60 80 L68 72" {...common} />
      <path d="M46 34 L32 50" {...common} />
      <path d="M46 34 L62 50" {...common} />
      <path d="M14 88 H86" {...common} />
    </svg>
  ),
  'Dorsiflexión': (
    <svg viewBox="0 0 100 100">
      <path d="M84 8 V90" {...common} />
      <Head cx={34} cy={20} />
      <path d="M34 27 V58" {...common} />
      <path d="M34 58 L30 88" {...common} />
      <path d="M34 58 L58 66 L58 88" {...common} />
      <path d="M58 88 L72 88" {...common} />
      <path d="M34 36 L60 40" {...common} />
    </svg>
  ),
  'Equilibrio': (
    <svg viewBox="0 0 100 100">
      <Head cx={50} cy={16} />
      <path d="M50 23 V56" {...common} />
      <path d="M50 56 V88" {...common} />
      <path d="M50 56 L68 66 L62 78" {...common} />
      <path d="M50 34 L24 44" {...common} />
      <path d="M50 34 L76 44" {...common} />
      <path d="M36 90 H64" {...common} />
    </svg>
  ),
  'Alfabeto pie': (
    <svg viewBox="0 0 100 100">
      <Head cx={26} cy={22} />
      <path d="M26 29 V56 L52 56" {...common} />
      <path d="M52 56 L74 46" {...common} />
      <path d="M26 56 V84" {...common} />
      <text x="62" y="30" fontSize="16" fontWeight="800" fill="currentColor" stroke="none">A B C</text>
    </svg>
  ),
  'default': (
    <svg viewBox="0 0 100 100">
      <rect x="30" y="46" width="40" height="8" rx="3" {...common} />
      <circle cx="24" cy="50" r="8" {...common} />
      <circle cx="76" cy="50" r="8" {...common} />
    </svg>
  )
};

export default function ExerciseIcon({ name }) {
  const svg = ICONS[name] || ICONS.default;
  return <div className="exercise-icon">{svg}</div>;
}
