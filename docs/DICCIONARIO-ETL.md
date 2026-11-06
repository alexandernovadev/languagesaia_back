# ETL del diccionario

Cómo se llena el diccionario de Glota con las palabras más comunes de cada idioma. Es un ETL con IA: se extrae una lista de frecuencia real, la IA la transforma en fichas revisadas y se cargan en `words`.

**Meta:** unas 10.000 palabras por idioma, por tandas. Primero portugués de Brasil, después inglés de USA.

```
Lista de frecuencia ──▶ Limpieza con IA ──▶ Ficha + revisión con IA ──▶ words
(50.000 formas)         (formas → lemas)    (DeepSeek, dos llamadas)    (solo diccionario)
   EXTRACT                 TRANSFORM              TRANSFORM                 LOAD
```

## Extract: la lista

**Fuente:** [FrequencyWords](https://github.com/hermitdave/FrequencyWords), basada en subtítulos de OpenSubtitles 2018. Es lenguaje hablado y el orden es frecuencia real. Las listas son CC-BY-SA 4.0, y el crédito está en `scripts/data/README.md`.

No se le pide a la IA que invente la lista: daría una creíble, pero no un orden real.

## Transform 1: de formas a palabras

`scripts/build-word-list.ts` convierte la lista cruda en `scripts/data/common-words-<idioma>.json`.

- Agrupa formas en su palabra de diccionario: `é`, `foi`, `era` → `ser`.
- Quita nombres propios, otros idiomas, groserías, abreviaturas y fragmentos.
- Conserva el orden de la fuente: la posición de cada palabra es su `rank`.

Referencia: en portugués, 3.500 formas dieron 1.883 palabras. Esa proporción baja al avanzar en la lista.

```bash
npx tsx scripts/build-word-list.ts pt <archivo-frecuencia.txt> 1000
```

## Transform 2 y Load: las fichas

`scripts/seed-dictionary.ts` recorre la lista y, por cada palabra:

1. **Ya existe:** solo le pone su `rank`. No genera nada ni gasta tokens.
2. **Casi igual salvo una tilde:** la salta y la reporta, porque `esta` y `está` pueden ser palabras distintas. Decide una persona.
3. **Es nueva:** DeepSeek escribe la ficha.
4. **Revisión:** una segunda llamada la revisa.
5. **Se guarda siempre:** si la revisión encuentra problemas, se guardan en `reviewNotes` para corregirlos después. Lo que se paga no se tira.

```bash
pnpm seed:dictionary pt
pnpm seed:dictionary pt --redo=<source>   # reescribe las fichas de ese origen
```

**Todo local con Gemma:** arranca primero el servidor y añade `--writer=gemma`. Gemma escribe y revisa, sin usar ninguna API.

```bash
cd ~/.cache/glota-llm
.venv/bin/python -m mlx_lm.server --model mlx-community/gemma-4-26b-a4b-it-4bit --host 127.0.0.1 --port 8088 --max-tokens 1600 --chat-template-args '{"enable_thinking":false}'
pnpm seed:dictionary pt --writer=gemma
```

Con 24 GB la memoria va justa: en una ejecución larga la GPU se quedó sin memoria tras unas 200 fichas (`Insufficient Memory`). Si pasa, se reinicia el servidor y se vuelve a ejecutar; continúa con lo que falta. Conviene cerrar apps pesadas.

Hay que apagar el modo de razonar. Encendido, Gemma gasta todos los tokens pensando y devuelve la respuesta vacía.

Se puede parar y volver a ejecutar: continúa con lo que falta. Usa 2 peticiones a la vez y reintenta ante el error 429 de Fireworks, con esperas crecientes.

## Qué lleva una ficha

| Campo | Contenido |
|---|---|
| `definition`, `examples` | Definición sencilla y 3 ejemplos de nivel A1–A2 |
| `spanish` | Traducción y definición en español |
| `type`, `IPA`, `synonyms` | Tipo de palabra, pronunciación y hasta 3 sinónimos |
| `conjugations` | Solo verbos: tiempo → persona → forma |
| `rank` | Posición en la lista de frecuencia |
| `source` | Qué IA la escribió |
| `reviewNotes` | Problemas encontrados; vacío si pasó la revisión |
| `audio` | Pronunciación: se crea con fal.ai la primera vez que alguien la escucha y queda en PocketBase |. Ejemplos y expresiones se guardan aparte, en `SpeechClip`, por su texto |

No lleva imagen: la tarjeta sin imagen muestra la inicial. El admin la crea a mano cuando quiera.

**Conjugaciones en portugués:** presente, pretérito perfeito, imperfeito, futuro y presente do subjuntivo, con eu, você, nós, eles. Un verbo es una sola entrada con su tabla dentro, no una entrada por forma.

## Reglas

- El ETL solo escribe en `words`: **nunca en la lista de nadie**.
- Las palabras entran solas a "Mis palabras": cuando Repasar se queda sin nuevas, toma las siguientes por `rank`, sin límite diario. Una palabra de la lista no se puede quitar.
- Las palabras existentes no se sobrescriben, salvo con `--redo`.
- Portugués solo de Brasil e inglés solo de USA, en todos los prompts (`prompts/langUtils.ts`).
- Las tildes importan: son parte del idioma.

## Por qué DeepSeek

Piloto del 2026-11-05: 50 palabras repartidas entre dos modelos, cada uno revisando al otro.

| | DeepSeek | Gemini Flash Lite |
|---|---|---|
| Tiempo por palabra | 10,5 s | 1,6 s |
| Tokens por palabra | 1.665 | 248 |
| Conjugaciones correctas | 84/84 | 79/84 |

Flash Lite conjugó el futuro de `vir` como `ver`, y tuvo fallos de IPA y ejemplos sin la palabra. Se descartó: un error aquí se queda en lo que vas a estudiar. Son muestras pequeñas y con verbos distintos en cada modelo.

## Modelo local

Spike del 2026-11-05 en el M4 de 24 GB, con 15 palabras y un Mac ocupado:

| | Gemma 4 26B-A4B | Qwen 3.8 27B |
|---|---|---|
| Conjugaciones irregulares | 172/172 | 163/172 |
| Tiempo por ficha | ~10 s | ~65 s |
| Velocidad | 33 tokens/s | 5,3 tokens/s |

Gemma es gratis y acertó todos los irregulares comprobados, aunque su IPA es menos brasileño y alguna definición sale floja. Ocupa unos 15 GB, así que no puede correr a la vez que FLUX.

## Plan por tandas

Cada tanda se revisa antes de lanzar la siguiente.

| Tanda | Estado |
|---|---|
| Portugués 1.000 | Hecho: 695 con DeepSeek, 218 con Gemma y 87 escritas por Claude (`scripts/data/claude-entries-pt.json`) |
| Portugués 2.500, 5.000 y 10.000 | Pendiente |
| Inglés 1.000 | Hecho: 1.009 palabras de la lista, escritas por Claude a mano (`scripts/data/claude-entries-en-1..10.json`), sin revisión aparte |
| Inglés 2.500, 5.000 y 10.000 | Pendiente |

**Estimación por idioma para 10.000 palabras:** 20–30 horas de ejecución y unos 30 millones de tokens de salida, contando ficha y revisión. Conviene comprobar el precio en Fireworks antes de cada tanda grande.

## Pendiente

- Corregir las fichas con `reviewNotes`.
- Exportar e importar: hoy el archivo lleva todo el diccionario y la importación enlaza todas las palabras a quien importa. Hay que marcar cuáles son de tu lista.
- La cola de la lista trae más ruido (`cincinnati`, `yorkshire`). Quizá haga falta otra fuente para el tramo final.
