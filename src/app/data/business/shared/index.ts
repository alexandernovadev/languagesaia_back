// Centralized export of shared business data
export { topicsJson, topicsList } from './topics';
export { skillsJson, skillsList } from './skills';
export { certificationLevelsJson, certificationLevelsList } from './certificationLevels';
export { difficultyJson, difficultyList } from './difficulty';
export {
  languagesJson,
  languagesList,
  contentLanguagesJson,
  contentLanguagesList,
} from './languages';
export { expressionTypesJson, expressionTypesList } from './expressionTypes';
export { chatRolesJson, chatRolesList } from './chatRoles';
export { readingTypesJson, readingTypesList } from './readingTypes';
export { systemRolesJson, systemRolesList } from './systemRoles';
export { wordTypesJson, wordTypesList } from './wordTypes';
export { storyGenresJson, storyGenresList } from './storyGenres';
export {
  getWordTypesForLanguage,
  validateWordTypesForLanguage,
  filterTypesQueryForLanguage,
  WordTypeValidationError,
} from './wordTypeCatalog';

// Re-export business types for convenience
export type { 
  Topic, Skill, WordType, ExpressionType, ReadingType, 
  Difficulty, CertificationLevel, Language, UserRole, ChatRole,
  GrammarTopic, GrammarTopicOption, StoryGenre
} from '../../../../../types/business';
