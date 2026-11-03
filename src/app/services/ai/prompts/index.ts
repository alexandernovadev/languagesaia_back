// Centralized export of all AI prompts

// Expression Prompts
export {
  createExpressionGenerationPrompt,
  createExpressionChatPrompt,
  type ExpressionGenerationPromptParams,
  type ExpressionChatPromptParams,
} from './expressionPrompts';

// Word Prompts
export * from './words';

// Image Prompts (FLUX: scene written by the text AI + house style)
export { buildImagePrompt, wordImagePrompt, expressionImagePrompt, storyImagePrompt, type ImageSubject } from './imagePrompts';
