# Ideas de IA local para Glota

Tareas de Hugging Face que pueden servirle a Glota. Son ideas por explorar, sin decidir ni probar, salvo donde se indica.

| Tarea | Qué hace | Para qué en Glota | Modelos candidatos |
|---|---|---|---|
| **Text Generation** | Escribe texto | Fichas del diccionario | Gemma 4 26B, en uso |
| **Text-to-Image** | Texto a imagen | Imágenes de las palabras | FLUX schnell, en uso; por comparar: FLUX.2 klein, Z-Image Turbo |
| **Text-to-Speech** | Texto a voz | Alternativa gratis a fal.ai, que hoy hace la pronunciación | Chatterbox y Qwen3-TTS, ya descargados |
| **Automatic Speech Recognition** | Voz a texto | Ejercicios de hablar en Lecciones | Whisper, Parakeet |
| **Sentence Similarity** | Mide cuánto se parecen dos frases | Comprobar una traducción libre sin gastar un LLM | Por investigar |
| **Feature Extraction** | Convierte texto en números (embeddings) | Buscar palabras por significado, no solo por cómo se escriben | Por investigar |
| **Token Classification** | Etiqueta cada palabra | Marcar verbos, sustantivos, etc. en frases de historias | Por investigar |
| **Translation** | Traduce entre idiomas | Traducir frases en el lector de Historias | Por investigar |
| **Image-Text-to-Text** | Ve una imagen y responde | Revisar imágenes generadas para detectar fallos | Modelos con visión |

**Límite:** lo que corre en el Mac sirve para generar por adelantado. El VPS no tiene GPU, así que lo que deba responder en vivo, como reconocer voz, necesita otra solución.
