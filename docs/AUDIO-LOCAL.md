# Audio de las palabras en local

La pronunciación de cada palabra se genera gratis en el Mac y se guarda en PocketBase. Todas usan la misma voz de mujer, en inglés y en portugués.

```
Palabra ──▶ Voz (Qwen3-TTS) ──▶ Recorte ──▶ Revisión (Whisper) ──▶ MP3 ──▶ PocketBase ──▶ word.audio
```

## Voz

Qwen3-TTS 1.7B Base clona a Matilda, de ElevenLabs. Las referencias están en `~/.cache/glota-audio`, con su texto en `refs.json`:

- **Inglés:** una frase generada con fal.ai.
- **Portugués:** un trozo de la narración de *A Última Arara*.

Se descartaron Chatterbox, que decía la palabra y mucho más, y la voz descrita de Qwen, que en portugués sonaba mal.

## Instalación

Todo va en `~/.cache/glota-audio`, fuera del proyecto.

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python mlx-audio
```

`whisper/` junta los pesos de `mlx-community/whisper-large-v3-turbo` con los archivos de tokenizer de `openai/whisper-large-v3-turbo`, porque el repo de MLX no los trae.

## Uso

```bash
npx tsx scripts/generate-word-audio.ts en              # todas las que faltan
npx tsx scripts/generate-word-audio.ts en --limit=100  # las 100 primeras
npx tsx scripts/generate-word-audio.ts en --dry        # solo los archivos, sin guardar
```

Se puede parar y volver a ejecutar: continúa con lo que falta. Las palabras con audio no se tocan, incluidas las hechas con fal.ai.

## Revisión

Whisper escucha cada audio. Si no se parece a la palabra o dura demasiado, se reintenta hasta 3 veces. Si sigue mal se guarda igual y queda en `review-<idioma>.jsonl` para escucharlo.

## Resultados

Piloto del 2026-11-07: 100 palabras, ninguna marcada para revisar. Tarda 2,3 s por palabra en inglés y 3 s en portugués.

## Pendiente

- Las palabras que se crean en la app siguen usando fal.ai, con otra voz, hasta la siguiente tanda.
- Ejemplos y expresiones siguen con fal.ai.
