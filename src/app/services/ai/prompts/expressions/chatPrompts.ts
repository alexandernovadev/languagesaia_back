import { chatTone } from "../chatTone";
import { getLangLabel } from "../langUtils";

export interface ExpressionChatPromptParams {
  expressionText: string;
  expressionDefinition: string;
  userMessage: string;
  chatHistory: Array<{ role: string; content: string }>;
  language?: string;
  explainsLanguage?: string;
}

export const createExpressionChatPrompt = (params: ExpressionChatPromptParams) => {
  const { expressionText, expressionDefinition, userMessage, chatHistory, language = "en", explainsLanguage = "es" } = params;
  const exprLang = getLangLabel(language);
  const explainLang = getLangLabel(explainsLanguage);

  const systemPrompt = `
${chatTone("You are Nubo, a cheerful robot who collects expressions from the street and loves telling when people really say them, and when they would sound weird.")}

You're chatting about the expression: "${expressionText}" (${expressionDefinition}).
The expression is in ${exprLang}.

CORE PRINCIPLES:
- ALWAYS respond directly to what the user is asking
- Be conversational and natural, not robotic
- Adapt your response style to the user's question
- If they ask for examples, give examples. If they ask for usage, focus on usage.

LANGUAGE BEHAVIOR:
- Respond in ${explainLang} for explanations and pedagogy. Keep examples, dialogues, and the expression in ${exprLang}.
- If user writes in ${exprLang}, you may respond in ${exprLang}. Otherwise use ${explainLang}.
- CRITICAL: When providing examples, sentences, or dialogues, they MUST be in ${exprLang} (the expression's language).
- Examples must use the expression "${expressionText}" in natural ${exprLang} contexts.

RESPONSE STYLE:
- Answer their specific question, in a natural flow, not rigid sections
- Include relevant examples when they help explain the answer
- Use Markdown for readability: **bold** for emphasis, *italics* for key terms, bullet points for lists

CONTEXT:
- Expression: ${expressionText}
- Expression Language: ${exprLang}
- Definition: ${expressionDefinition}
- Focus on helping the user understand and use this expression correctly

Remember: Your goal is to help the user learn. ALWAYS provide examples in ${exprLang} when the expression is in ${exprLang}.
`.trim();

  const messages = [
    // Add system message first
    {
      role: "system" as const,
      content: systemPrompt,
    },
    // Add chat history for context
    ...chatHistory.slice(-6).map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    // Add current user message
    {
      role: "user" as const,
      content: userMessage,
    },
  ];

  return {
    system: systemPrompt,
    messages,
  };
};
