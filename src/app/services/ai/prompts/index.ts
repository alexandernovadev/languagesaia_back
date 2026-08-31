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

// Image Prompts
export {
  createImagePrompt,
  type ImagePromptParams,
  imageWordPrompt,
  createExpressionImagePrompt,
  createStoryImagePrompt,
} from './imagePrompts';
