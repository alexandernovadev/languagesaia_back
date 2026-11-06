# Imágenes generadas en local

Las imágenes de las palabras se pueden generar gratis en el Mac, con el mismo tipo de modelo que usa fal.ai, y guardarse en PocketBase en vez de en Cloudinary. Se hizo porque fal.ai cuesta por imagen y Cloudinary tiene límite de almacenamiento.

```
Palabra ──▶ Escena (DeepSeek) ──▶ Imagen (FLUX en el Mac) ──▶ WebP ──▶ PocketBase ──▶ word.img
             ~1 s                  ~90–110 s                  sharp     VPS
```

## Máquina

Apple M4 (chip base), GPU de 10 núcleos, 24 GB de memoria compartida.

## Instalación

Todo va en `~/.cache/glota-images`, fuera del proyecto.

```bash
mkdir -p ~/.cache/glota-images && cd ~/.cache/glota-images
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python mflux
.venv/bin/python -c "from huggingface_hub import snapshot_download; snapshot_download('dhairyashil/FLUX.1-schnell-mflux-4bit')"
```

El modelo pesa 9 GB y su licencia es Apache 2.0. [mflux](https://github.com/filipstrand/mflux) corre estos modelos sobre MLX, la librería de Apple.

## Uso

```bash
npx tsx scripts/generate-images.ts en pasta,priest,hallway
```

Por cada palabra:

1. Salta las que ya tienen imagen.
2. Escribe la escena con la misma lógica de la app (`wordImagePrompt`), así que el estilo combina con las imágenes actuales.
3. Genera un PNG de 768 × 768 en 4 pasos, en `~/.cache/glota-images/out/`.
4. Lo convierte a WebP con calidad 80.
5. Lo sube a la colección `word_images` y guarda la URL en `word.img`.

El PNG es solo un paso intermedio. La app usa el WebP.

## Dónde se guardan

- **Colección `word_images`** en PocketBase, en el VPS: `image`, `wordId`, `word`. Lectura pública, escritura solo de admin.
- **Panel:** `https://languagesapipocketbase.nova-inns.pro/_/`
- **URL de ejemplo:** `/api/files/word_images/<id>/<archivo>.webp`

Las imágenes anteriores siguen en Cloudinary. El campo `img` guarda una URL, así que a la app le da igual de dónde venga.

## Resultados

Prueba del 2026-11-05 con 10 palabras en inglés, con el ETL del diccionario corriendo a la vez.

| | |
|---|---|
| Tiempo por imagen | 86–108 s, incluida la carga del modelo en cada una |
| Peso en WebP | 6–64 KB, la mayoría alrededor de 20 KB |
| Calidad | Muy buena, también en palabras abstractas como `weary` |

**Estimación:** 1.000 imágenes son unas 25 horas, y 20.000 imágenes unos 400 MB. Hay que dejarlo por las noches. Este proceso es para llenar el diccionario: para generar una imagen en vivo es demasiado lento.

## Otros modelos

FLUX schnell es de 2024. mflux soporta modelos más nuevos. Calidad y tiempo sin medir en esta máquina:

| Modelo | Versión | Licencia | Qué se espera |
|---|---|---|---|
| Z-Image Turbo | 4, 6 y 8 bits | Apache 2.0 | Moderno y pensado para pocos pasos |
| FLUX.2 klein 4B | 4 bits | Apache 2.0 | Más nuevo y pequeño, quizá más rápido |
| Qwen Image 2.1 | 4 bits y turbo | Por revisar | Muy capaz, más pesado |
| FLUX.1 dev | Requiere pedir acceso | Con restricciones | Más detalle, varias veces más lento |

**Límites:** el sistema se reserva parte de los 24 GB, así que los modelos grandes necesitan 4 bits, y el M4 base puede tardar varios minutos con ellos. Cambiar de modelo también cambia algo el estilo frente a las imágenes actuales.

**Siguiente prueba:** las mismas 3 palabras con Z-Image Turbo y FLUX.2 klein, comparadas con FLUX schnell, sin generar a la vez para no competir por la memoria.

## Pendiente

- **Palabras con dos significados:** `chugging` mezcló "beber" y "motor" porque su definición trae los dos. Idea: que la llamada de la escena devuelva una o dos escenas, generarlas por separado y unirlas con `sharp`, mitad y mitad.
- **Escenas complejas:** en `stern` el niño quedó sin cuerpo detrás del escritorio. Idea: pedir un solo personaje, con el cuerpo visible y sin objetos tapándolo. Fallaron 2 de 40 imágenes.
- Cargar el modelo una sola vez para todas las imágenes, en vez de una por imagen.
- Saltar palabras sin imagen útil (`que`, `mas`, `sobre`).
- Borrar los PNG al terminar, si se generan miles.
- El botón "Otra imagen" del admin sigue usando fal.ai y Cloudinary.
- Las imágenes solo están en el VPS: incluir la carpeta de PocketBase en sus backups.
