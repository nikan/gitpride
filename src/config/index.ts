/**
 * Config module — public API.
 */

export { loadConfig, parseConfig, ConfigLoadError, ConfigValidationError } from './loader.js';
export {
  validateCommandArgs,
  validateExtraArgs,
  validateCombinedArgs,
  DestructiveCommandError,
  BLOCKED_SUBCOMMANDS,
  BLOCKED_ARG_SEQUENCES,
  BLOCKED_SHELL_OPERATORS,
} from './guard.js';
export type { CommandConfig, CommandsConfig, ExtraArgsSchema, ExtraArgsProperty } from './types.js';
