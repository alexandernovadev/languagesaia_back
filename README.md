# Glota · Back

API de Glota, una app para aprender idiomas con IA. Antes se llamaba LanguagesAI, y ese nombre sigue en las carpetas y en algunas rutas de Cloudinary.

## Stack

- Node.js (`>=20.3`), TypeScript, Express 5
- MongoDB con Mongoose
- pnpm

| Para qué | Proveedor |
|---|---|
| Texto (palabras, expresiones, historias, chats, lecciones) | Fireworks |
| Imágenes | fal.ai |
| Audio de capítulos y transcripción | OpenAI |
| Almacenamiento de imágenes | Cloudinary |
| Almacenamiento de audio | PocketBase |

Proveedores y modelos se cambian en un solo archivo: `src/config/aiConfig.ts`. Qué modelos funcionan y cuáles no está en [`docs/MODELOS-IA.md`](docs/MODELOS-IA.md).

## Puesta en marcha

Hace falta una instancia de MongoDB.

```bash
pnpm install
cp .env.example .env   # y rellena los valores
pnpm dev
```

`pnpm dev` vacía los archivos de `logs/` cada vez que arranca.

El servidor escucha en `PORT` y `GET /` sirve para comprobar que está vivo.

## Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Vacía los logs y arranca con recarga automática |
| `pnpm typecheck` | Comprueba los tipos |
| `pnpm build` | Compila a `dist/` |
| `pnpm start` | Arranca la versión compilada |
| `pnpm clean:logs` | Vacía los logs |

## Estructura

```
src/
├── main.ts          Arranque y registro de rutas
├── config/          env (carga .env), aiConfig y constantes
└── app/
    ├── routes/      Definición de endpoints
    ├── controllers/ Entrada y salida HTTP
    ├── services/    Lógica de negocio e integraciones (ai/, words/, lessons/…)
    ├── db/models/   Esquemas de Mongoose
    ├── middlewares/ Auth, límites de peticiones y subidas
    ├── validators/  Esquemas de Zod
    ├── dto/         Forma de las respuestas
    ├── data/        Catálogos (idiomas, gramática, tipos de palabra…)
    └── utils/
types/               Tipos compartidos de modelos y negocio
```

`src/config/env.ts` debe seguir siendo el primer import de `main.ts`, porque muchos módulos leen `process.env` al importarse.

## API

Todo cuelga de `/api` y, salvo `/api/auth`, necesita `Authorization: Bearer <token>`.

| Ruta | Contenido |
|---|---|
| `/api/auth` | Login y refresh |
| `/api/users` | Usuarios |
| `/api/words` | Palabras, tarjetas de repaso, chat y generación con IA |
| `/api/expressions` | Expresiones |
| `/api/stories` | Historias y capítulos |
| `/api/lessons` | Prácticas, respuestas, estadísticas y chat |
| `/api/labs` | Panel de admin (solo rol `admin`) |
| `/api/upload-image/:entityType/:entityId` | Subida de imágenes |

Las respuestas tienen la forma `{ success: true, message, data }` o `{ success: false, error }`. Un token inválido o caducado devuelve 401, y el front lo renueva con `/api/auth/refresh`.

## Palabras y usuarios

`Word` es el diccionario compartido: definición, ejemplos, imagen. Solo un admin cambia su contenido. `UserWord` guarda lo de cada usuario: dificultad, veces vistas, chat y calendario de repaso. "Mis palabras" son las que tienen un `UserWord`; añadir una que ya está en el diccionario solo la enlaza, sin usar la IA.

Para llevar los datos a otro servidor: exportar e importar desde `/admin/datos`, con el admin ya creado. El archivo incluye el progreso del admin (dificultad, veces vistas, chat y calendario de repaso).

## Backups

Cada noche (`BACKUP_CRON_SCHEDULE`) se envían por correo las palabras y las expresiones en JSON, si `BACKUP_EMAIL_ENABLED=true`. Se gestionan desde `/admin` en la app.
