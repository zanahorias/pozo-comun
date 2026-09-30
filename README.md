# Pozo Común

App de hábitos y entrenamiento en pareja/equipo, con pozo de puntos compartido,
calendario de cumplimiento, gym/running y tienda de recompensas.

Funciona en el navegador (PC o celular) y se puede instalar como app en
Android en ambos teléfonos, compartiendo los mismos datos en tiempo real
a través de Supabase.

---

## 1. Crear el backend en Supabase (una sola vez)

1. Andá a https://supabase.com, creá una cuenta gratis y un proyecto nuevo.
2. En el panel del proyecto, abrí **SQL Editor** → **New query**, pegá todo
   el contenido de `schema.sql` (está en la raíz de este proyecto) y ejecutalo.
   Esto crea las tablas y carga los hábitos/recompensas iniciales, con
   **Nico** como usuario admin y **Compañero/a** como el segundo usuario
   (podés cambiar esos nombres directamente en la tabla `users` desde
   **Table Editor**).
3. En **Database → Replication**, activá Realtime para las tablas:
   `habit_logs`, `workouts`, `redemptions`, `habits`, `rewards`.
   Así los cambios de un teléfono se reflejan al instante en el otro.
4. En **Project Settings → API**, copiá la **Project URL** y la **anon public key**.

> Nota de seguridad: para simplificar este MVP de uso privado entre dos
> personas, las tablas quedan sin Row Level Security (RLS). Cualquiera con
> el link de la app y la anon key podría leer/escribir datos. Es razonable
> para un proyecto personal, pero si más adelante lo compartís más
> ampliamente, conviene activar RLS + Supabase Auth.

## 2. Configurar el proyecto localmente

Necesitás tener [Node.js](https://nodejs.org) instalado (versión 18 o superior).

```bash
npm install
cp .env.example .env
```

Editá `.env` y pegá tu URL y anon key de Supabase:

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

## 3. Ver la app en el navegador

```bash
npm run dev
```

Abrí la URL que te muestra la consola (por defecto `http://localhost:5173`).
Desde el celular en la misma wifi también podés entrar usando la IP de tu
compu que aparece como "Network" en esa misma consola.

**Para tenerla en un link de verdad, accesible desde cualquier lado** (el
"extra" de verla en el navegador sin correr nada localmente): subí este
proyecto a [Vercel](https://vercel.com) o [Netlify](https://netlify.com)
(ambos tienen plan gratis, se conectan directo a un repo de GitHub),
agregando las mismas dos variables de entorno (`VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY`) en la configuración del proyecto. Una vez
desplegada, el navegador va a ofrecer "Instalar app" (es una PWA), lo que
la deja con ícono propio también en PC.

## 4. Instalarla como app nativa en los dos Android

Esto empaqueta la misma app web dentro de un contenedor nativo Android
usando [Capacitor](https://capacitorjs.com), sin reescribir nada.
Hay dos formas de conseguir el `.apk`: sin instalar nada (opción A, recomendada)
o con Android Studio en tu compu (opción B).

### Opción A — Compilarlo en la nube con GitHub Actions (sin instalar nada)

Este proyecto ya incluye `.github/workflows/build-android.yml`, que compila
el APK automáticamente cada vez que subís cambios a GitHub.

1. Creá un repositorio en [GitHub](https://github.com) (gratis) y subí esta
   carpeta ahí (`git init`, `git add .`, `git commit`, `git push`, o usando
   la opción "Upload files" del sitio si no usás git).
2. En el repo, andá a **Settings → Secrets and variables → Actions** y creá
   dos "repository secrets":
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (los mismos valores que pusiste en tu `.env`).
3. Andá a la pestaña **Actions** del repo → el workflow "Build Android APK"
   se dispara solo al subir a `main`, o lo podés lanzar a mano con
   "Run workflow".
4. Cuando termine (unos 3-5 minutos), entrá a esa ejecución y bajá el
   archivo `pozo-comun-apk` en la sección **Artifacts**. Ahí adentro está
   el `app-debug.apk`.
5. Mandate ese APK por WhatsApp/Drive a los dos teléfonos e instalalo
   (Android va a pedir permiso para "instalar apps de fuentes
   desconocidas" la primera vez).

Repetís los pasos 3-4 cada vez que quieras una versión nueva con cambios.

### Opción B — Compilarlo vos con Android Studio

Necesitás tener instalado [Android Studio](https://developer.android.com/studio)
en tu computadora (una sola vez, en cualquiera de las dos compus o en una sola).

```bash
npm run build
npx cap add android
npm run cap:sync
npm run cap:open:android
```

Esto abre el proyecto en Android Studio. Ahí tenés dos caminos:

- **Instalar directo por cable**: conectá el celular por USB con la
  "Depuración USB" activada (Ajustes → Opciones de desarrollador), elegilo
  como dispositivo de destino en Android Studio y tocá "Run" (▶). Repetís
  este paso con el segundo teléfono.
- **Generar un APK para instalar en ambos sin cable**: en Android Studio,
  `Build → Build Bundle(s) / APK(s) → Build APK(s)`. Te deja un archivo
  `.apk` que podés mandarte por WhatsApp/Drive a los dos celulares e instalar
  directamente (Android va a pedir permiso para "instalar apps de fuentes
  desconocidas" la primera vez).

Los dos teléfonos van a compartir el mismo pozo de puntos en tiempo real,
porque ambos hablan con el mismo backend de Supabase.

## 5. Primer uso

Al abrir la app por primera vez en cada dispositivo, te va a pedir elegir
tu perfil (Nico / Compañero-a). Se guarda en ese dispositivo, así que cada
uno elige el suyo una sola vez.

## Estructura del proyecto

```
src/
  lib/            funciones puras (fechas, cálculo de puntos/estados) y cliente de Supabase
  hooks/
    useAppData.js  carga de datos + suscripción en tiempo real + acciones (marcar hábito, registrar entrenamiento, canjear, etc.)
  components/      pantallas: Tablero, Hábitos, Entrenamiento, Tienda, encabezado, selector de perfil
schema.sql         esquema completo de la base de datos + datos iniciales
```

## Próximos pasos posibles

- Reemplazar el selector de perfil sin contraseña por Supabase Auth, si en
  algún momento se comparte con más gente.
- Conectar el comodín "perdón un hábito" con la lógica real de penalización
  (hoy resta puntos al canjearlo pero no evita el "no cumplido" automático).
- Agregar notificaciones push para recordar hábitos pendientes del día.
