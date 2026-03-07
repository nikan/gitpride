/**
 * Config module — public API.
 */

export { loadConfig, parseConfig, ConfigLoadError, ConfigValidationError } from './loader.js';
export {
  validateCommandArgs,
  validateExtraArgs,
  validateCombinedArgs,
  buildGuardOptions,
  DestructiveCommandError,
  BLOCKED_SUBCOMMANDS,
  BLOCKED_ARG_SEQUENCES,
  BLOCKED_SHELL_OPERATORS,
} from './guard.js';
export type {
  CommandConfig,
  CommandsConfig,
  ExtraArgsSchema,
  ExtraArgsProperty,
  AllowedOperation,
  GuardOptions,
} from './types.js';
