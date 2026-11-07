# Diccionario: las fichas de Claude

Cómo se llena el diccionario de Glota con las palabras más comunes de cada idioma. Las fichas las escribe Claude a mano, a partir de una lista de frecuencia real, y se guardan como JSON en `scripts/data/`. Un script las carga en `words`; no se llama a ninguna IA en la carga.

**Meta:** unas 10.000 palabras por idioma, por tandas. Primero portugués de Brasil, después inglés de USA.

```
Lista de frecuencia ──▶ Claude escribe las fichas ──▶ seed-dictionary ──▶ words
(FrequencyWords)        (claude-entries-*.json)       (solo carga)        (solo diccionario)
```

> Antes existía un ETL que generaba las fichas con IA externa (DeepSeek vía
> Fireworks, o Gemma local): `build-word-list.ts` + `seed-dictionary.ts` con
> `--writer`. Se eliminó; queda solo la vía de las fichas escritas por Claude.

## La lista de frecuencia

**Fuente:** [FrequencyWords](https://github.com/hermitdave/FrequencyWords), basada en subtítulos de OpenSubtitles 2018. Es lenguaje hablado y el orden es frecuencia real. Las listas son CC-BY-SA 4.0, y el crédito está en `scripts/data/README.md`.

No se le pide a la IA que invente la lista: daría una creíble, pero no un orden real. La posición de cada palabra en la lista es su `rank`.

## Las fichas

Claude escribe las fichas por tandas y se commitean en `scripts/data/claude-entries-<idioma>[-N].json`. Cada entrada lleva:

| Campo | Contenido |
|---|---|
| `rank` | Posición en la lista de frecuencia |
| `word`, `type`, `IPA` | Palabra, tipo gramatical y pronunciación |
| `definition`, `examples` | Definición sencilla y 3 ejemplos de nivel A1–A2 |
| `spanish` | Traducción y definición en español |
| `synonyms` | Hasta 3 sinónimos (puede estar vacío) |
| `conjugations` | Solo verbos: tiempo → persona → forma; `null` si no es verbo |

**Conjugaciones en portugués:** presente, pretérito perfeito, imperfeito, futuro y presente do subjuntivo, con eu, você, nós, eles. Un verbo es una sola entrada con su tabla dentro, no una entrada por forma.

Las fichas no llevan imagen ni audio: la tarjeta sin imagen muestra la inicial, y la pronunciación se crea con fal.ai la primera vez que alguien la escucha (nada de eso cambia con este script).

## La carga

`scripts/seed-dictionary.ts` recorre todos los `claude-entries-<idioma>*.json` y, por cada palabra:

1. **Ya existe:** solo le pone su `rank`. No toca los demás campos.
2. **Es nueva:** la crea con `source: "claude"`.
3. **Repetida entre archivos:** se carga una sola vez (gana el primer archivo).
4. **Error al crear:** se reporta y sigue con la siguiente.

```bash
pnpm seed:dictionary pt
pnpm seed:dictionary en --redo   # reescribe las fichas cuyo source es "claude"
```

Se puede parar y volver a ejecutar: continúa con lo que falta.

## Reglas

- El script solo escribe en `words`: **nunca en la lista de nadie**.
- Las palabras entran solas a "Mis palabras": cuando Repasar se queda sin nuevas, toma las siguientes por `rank`, sin límite diario. Una palabra de la lista no se puede quitar.
- Las palabras existentes no se sobrescriben, salvo con `--redo`.
- Portugués solo de Brasil e inglés solo de USA en todas las fichas.
- Las tildes importan: son parte del idioma.

## Estado por tandas

| Tanda | Estado |
|---|---|
| Portugués | ~4.570 fichas escritas por Claude (hasta el rank ~5.480) |
| Inglés | ~5.120 fichas escritas por Claude (hasta el rank ~5.120) |
| Ambos hasta 10.000 | Pendiente |

## Pendiente

- Seguir escribiendo fichas hasta las 10.000 por idioma.
- La cola de la lista trae más ruido (`cincinnati`, `yorkshire`). Quizá haga falta otra fuente para el tramo final.
