# Modelos de IA (Fireworks) · qué sirve y qué no

Prueba hecha el **2026-11-03** con la clave de la cuenta `titoantifa69-tqo133b`: los 30 modelos que devuelve `GET /inference/v1/models`, un mensaje corto ("Say hi in Spanish") a todos a la vez, con 25 s de límite.

> ⚠️ La disponibilidad **cambia**: el mismo modelo puede responder en una prueba y no en otra (ej. `kimi-k3-fast` dio 404 y luego 200; Qwen 3.8 respondía en la tarde y luego se colgaba). Vuelve a probar antes de cambiar el modelo principal.

## Configuración actual

En `src/config/aiConfig.ts` (`TEXT_AI`), el único sitio que hay que tocar:

| | Modelo |
|---|---|
| **Principal** (`models.default` y `models.reasoning`) | `accounts/fireworks/models/deepseek-v4p1-flash` |
| **Respaldo** (`fallback`) | `accounts/fireworks/models/kimi-k3` |

- Si el principal **no empieza a responder en 20 s** (`primaryTimeoutMs`), la misma petición se repite con el respaldo.
- Tras un fallo, durante **5 min** (`primaryCooldownMs`) todo va directo al respaldo; luego se vuelve a probar el principal.
- Límite duro de cada petición al respaldo: **90 s** (`timeoutMs`).
- Razonamiento (`reasoningEffort`): `low` para casi todo, `medium` para exámenes; las imágenes piden la escena con `none`.
- En el log del back: `[AI] … did not answer …; using fallback …`.

## ✅ Funcionan (chat), de más rápido a más lento

| Modelo | Tiempo | Nota |
|---|---|---|
| `nemotron-3-ultra-nvfp4` | 0,5 s | NVIDIA |
| `gpt-oss-120b` | 0,6 s | OpenAI open-weights |
| `glm-5p3-fast` | 0,6 s | |
| `deepseek-v4p1-flash-1017-ultrafast` | 0,6 s | |
| `deepseek-v4p1-flash-spot` | 0,6 s | spot |
| `glm-5p3-flash` | 0,7 s | |
| **`deepseek-v4p1-flash`** | 0,8 s | ⭐ principal actual |
| `minimax-m3p1-flash` | 0,9 s | |
| `spot-deepseek-v4-flash` | 1,0 s | spot |
| `nemotron-lightning-3p5-30b-a3b` | 1,1 s | pequeño (30B) |
| `deepseek-v4p1-flash-1017` | 1,2 s | |
| `ember-1` | 1,4 s | |
| `minimax-m3` | 1,5 s | |
| `kimi-k3-fast` | 2,4 s | intermitente (antes 404) |
| `auto` | 2,9 s | Fireworks elige el modelo |
| `glm-5p3` | 3,0 s | |
| `muse-spark-open` | 5,4 s | |
| **`kimi-k3`** | 6,0 s | ⭐ respaldo actual (acepta `reasoning_effort` y JSON) |
| `inkling` | 9,3 s | |

**Spot** = más barato pero puede quedar sin capacidad en cualquier momento: no usar como principal ni como respaldo.

## ❌ No sirven

| Modelo | Motivo |
|---|---|
| `qwen3p8-2p4t-a95b` | **no es serverless** (la página del modelo dice *Serverless: Not Supported*); sin despliegue dedicado, las peticiones se cuelgan |
| `qwen3p8-max` | serverless pero muy inestable/lento: a ratos no responde en 25 s |
| `glm-5p2-fast`, `kimi-k3-spot` | 404 · no desplegados (no serverless) |
| `glm-5p3-spot`, `deepseek-v4p1-flash-1017-spot` | 503 · "not ready to serve" en el momento de la prueba |
| `rune` | solo atiende `/v1/systemone`, no chat |
| `qwen3-reranker-8b`, `qwen3-embedding-8b` | no son de chat (búsqueda / embeddings) |
| Llama | no hay ningún Llama en la cuenta |

## Cómo volver a probar

```bash
# lista de modelos
curl -s https://api.fireworks.ai/inference/v1/models -H "Authorization: Bearer $FIREWORKS_API_KEY"

# probar uno (mira el tiempo y si responde)
curl -s -m 25 -w '\nHTTP %{http_code} %{time_total}s\n' https://api.fireworks.ai/inference/v1/chat/completions \
  -H "Authorization: Bearer $FIREWORKS_API_KEY" -H 'content-type: application/json' \
  -d '{"model":"accounts/fireworks/models/MODELO","max_tokens":200,"messages":[{"role":"user","content":"hi"}]}'
```

- Un modelo **no serverless** responde rápido con `404 Model not found, inaccessible, and/or not deployed` (o se queda colgado, como Qwen 3.8).
- Para usar uno no serverless hay que crear un *on-demand deployment* (GPUs dedicadas, pago por hora): https://docs.fireworks.ai/guides/ondemand-deployments
- Control de razonamiento: https://docs.fireworks.ai/guides/reasoning
