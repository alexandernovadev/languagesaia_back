# Modelos de IA de texto

Todo el texto de Glota sale de la API oficial de DeepSeek. Se configura en `src/config/aiConfig.ts` (`TEXT_AI`) con `DEEPSEEK_API_KEY`.

| Uso | Modelo |
|---|---|
| **Principal** (`models.default` y `models.reasoning`) | `deepseek-flash` (DeepSeek V4.1 Flash) |
| **Respaldo** (`fallback`) y segunda opinión al buscar frases | `deepseek-v4-pro` |

Si el principal no empieza a responder a tiempo, la misma petición pasa al respaldo y la app lo usa directamente durante 5 minutos.

## Historia

- **Fireworks:** se usó hasta el 2026-11-07, con DeepSeek V4.1 Flash y Kimi K3 de respaldo. Se dejó de usar.
- **API de OpenAI:** descartada por cara. Solo se usa su SDK (`openai`), que habla con DeepSeek porque su API es compatible.

## Prueba del 2026-11-07

Las dos aceptan `reasoning_effort` (`none`, `low`, `medium`, `high`) y `response_format: json_object`. Un saludo tardó 1,3 s en los dos modelos.

## Comandos útiles

```bash
# modelos disponibles
curl -s https://api.deepseek.com/models -H "Authorization: Bearer $DEEPSEEK_API_KEY"

# probar un modelo
curl -s https://api.deepseek.com/chat/completions \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" -H 'content-type: application/json' \
  -d '{"model":"deepseek-flash","max_tokens":200,"messages":[{"role":"user","content":"hi"}]}'
```
