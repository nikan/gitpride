/**
 * Structured logger — writes to stderr to keep stdout free for MCP stdio transport.
 *
 * Log level is controlled by the `LOG_LEVEL` environment variable
 * (debug | info | warn | error). Defaults to "info".
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function resolveLogLevel(): LogLevel {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  if (env && env in LEVEL_ORDER) return env as LogLevel;
  return 'info';
}

export class Logger {
  private readonly minLevel: number;

  constructor(
    private readonly name: string,
    level?: LogLevel,
  ) {
    this.minLevel = LEVEL_ORDER[level ?? resolveLogLevel()];
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < this.minLevel) return;

    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      name: this.name,
      message,
    };

    if (data) entry.data = data;

    process.stderr.write(JSON.stringify(entry) + '\n');
  }
}

/** Shared root logger for the server. */
export const logger = new Logger('gitpride');
