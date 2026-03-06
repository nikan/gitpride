import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  parseConfig,
  loadConfig,
  ConfigLoadError,
  ConfigValidationError,
} from '../../src/config/loader.js';

// Suppress logger output during tests
vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

const VALID_CONFIG = {
  commands: [
    {
      name: 'git_status',
      description: 'Show the working tree status',
      command: 'git',
      args: ['status'],
      allowExtraArgs: false,
    },
  ],
};

const VALID_CONFIG_WITH_EXTRA_ARGS = {
  commands: [
    {
      name: 'git_log',
      description: 'Show commit logs',
      command: 'git',
      args: ['log', '--oneline'],
      allowExtraArgs: true,
      extraArgsSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max commits', default: 20 },
        },
      },
    },
  ],
};

describe('parseConfig', () => {
  describe('valid configurations', () => {
    it('should parse a minimal valid config', () => {
      const result = parseConfig(VALID_CONFIG);
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].name).toBe('git_status');
    });

    it('should parse config with extraArgsSchema', () => {
      const result = parseConfig(VALID_CONFIG_WITH_EXTRA_ARGS);
      expect(result.commands[0].allowExtraArgs).toBe(true);
      expect(result.commands[0].extraArgsSchema).toBeDefined();
      expect(result.commands[0].extraArgsSchema!.properties.limit.type).toBe('number');
    });

    it('should accept $schema field', () => {
      const config = { $schema: './src/config/schema.json', ...VALID_CONFIG };
      const result = parseConfig(config);
      expect(result.$schema).toBe('./src/config/schema.json');
    });

    it('should parse multiple commands', () => {
      const config = {
        commands: [
          {
            name: 'git_status',
            description: 'Status',
            command: 'git',
            args: ['status'],
            allowExtraArgs: false,
          },
          {
            name: 'git_log',
            description: 'Log',
            command: 'git',
            args: ['log'],
            allowExtraArgs: false,
          },
        ],
      };
      const result = parseConfig(config);
      expect(result.commands).toHaveLength(2);
    });
  });

  describe('schema validation errors', () => {
    it('should reject empty commands array', () => {
      expect(() => parseConfig({ commands: [] })).toThrow(ConfigValidationError);
    });

    it('should reject missing commands field', () => {
      expect(() => parseConfig({})).toThrow(ConfigValidationError);
    });

    it('should reject invalid command name pattern', () => {
      const config = {
        commands: [
          {
            name: 'Git-Status',
            description: 'Status',
            command: 'git',
            args: ['status'],
            allowExtraArgs: false,
          },
        ],
      };
      expect(() => parseConfig(config)).toThrow(ConfigValidationError);
    });

    it('should reject non-git command', () => {
      const config = {
        commands: [
          {
            name: 'ls_files',
            description: 'List files',
            command: 'ls',
            args: ['-la'],
            allowExtraArgs: false,
          },
        ],
      };
      expect(() => parseConfig(config)).toThrow(ConfigValidationError);
    });

    it('should reject empty description', () => {
      const config = {
        commands: [
          {
            name: 'git_status',
            description: '',
            command: 'git',
            args: ['status'],
            allowExtraArgs: false,
          },
        ],
      };
      expect(() => parseConfig(config)).toThrow(ConfigValidationError);
    });

    it('should include field paths in validation errors', () => {
      try {
        parseConfig({ commands: [{ name: 123 }] });
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigValidationError);
        expect((err as ConfigValidationError).issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe('semantic validation errors', () => {
    it('should reject duplicate command names', () => {
      const config = {
        commands: [
          {
            name: 'git_status',
            description: 'Status 1',
            command: 'git',
            args: ['status'],
            allowExtraArgs: false,
          },
          {
            name: 'git_status',
            description: 'Status 2',
            command: 'git',
            args: ['status', '--short'],
            allowExtraArgs: false,
          },
        ],
      };
      expect(() => parseConfig(config)).toThrow(ConfigValidationError);
      try {
        parseConfig(config);
      } catch (err) {
        expect((err as ConfigValidationError).issues).toEqual(
          expect.arrayContaining([expect.stringContaining('Duplicate')]),
        );
      }
    });

    it('should reject destructive commands', () => {
      const config = {
        commands: [
          {
            name: 'git_push',
            description: 'Push changes',
            command: 'git',
            args: ['push'],
            allowExtraArgs: false,
          },
        ],
      };
      expect(() => parseConfig(config)).toThrow(ConfigValidationError);
    });

    it('should reject commands with shell operators', () => {
      const config = {
        commands: [
          {
            name: 'git_exploit',
            description: 'Bad command',
            command: 'git',
            args: ['log', '&&', 'rm', '-rf', '/'],
            allowExtraArgs: false,
          },
        ],
      };
      expect(() => parseConfig(config)).toThrow(ConfigValidationError);
    });
  });
});

describe('loadConfig', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `gitpride-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should load and validate a config file', async () => {
    const configPath = join(tempDir, 'commands.config.json');
    await writeFile(configPath, JSON.stringify(VALID_CONFIG));

    const result = await loadConfig(configPath);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].name).toBe('git_status');
  });

  it('should throw ConfigLoadError for missing file', async () => {
    await expect(loadConfig(join(tempDir, 'missing.json'))).rejects.toThrow(ConfigLoadError);
  });

  it('should throw ConfigLoadError for invalid JSON', async () => {
    const configPath = join(tempDir, 'bad.json');
    await writeFile(configPath, '{ not valid json }');
    await expect(loadConfig(configPath)).rejects.toThrow(ConfigLoadError);
  });

  it('should throw ConfigValidationError for invalid schema', async () => {
    const configPath = join(tempDir, 'invalid.json');
    await writeFile(configPath, JSON.stringify({ commands: [] }));
    await expect(loadConfig(configPath)).rejects.toThrow(ConfigValidationError);
  });

  it('should load config with extraArgsSchema', async () => {
    const configPath = join(tempDir, 'extra.json');
    await writeFile(configPath, JSON.stringify(VALID_CONFIG_WITH_EXTRA_ARGS));

    const result = await loadConfig(configPath);
    expect(result.commands[0].extraArgsSchema).toBeDefined();
  });
});

describe('strict schema validation (issue #41)', () => {
  it('should reject unknown properties at root level', () => {
    const config = {
      ...VALID_CONFIG,
      unknownField: 'surprise',
    };
    expect(() => parseConfig(config)).toThrow(ConfigValidationError);
  });

  it('should reject unknown properties at command level', () => {
    const config = {
      commands: [
        {
          name: 'git_status',
          description: 'Status',
          command: 'git',
          args: ['status'],
          allowExtraArgs: false,
          typoField: true,
        },
      ],
    };
    expect(() => parseConfig(config)).toThrow(ConfigValidationError);
  });

  it('should reject unknown properties in extraArgsSchema', () => {
    const config = {
      commands: [
        {
          name: 'git_log',
          description: 'Log',
          command: 'git',
          args: ['log'],
          allowExtraArgs: true,
          extraArgsSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'limit' },
            },
            badKey: 'should fail',
          },
        },
      ],
    };
    expect(() => parseConfig(config)).toThrow(ConfigValidationError);
  });

  it('should reject unknown properties in extraArgsProperty', () => {
    const config = {
      commands: [
        {
          name: 'git_log',
          description: 'Log',
          command: 'git',
          args: ['log'],
          allowExtraArgs: true,
          extraArgsSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'limit', oops: true },
            },
          },
        },
      ],
    };
    expect(() => parseConfig(config)).toThrow(ConfigValidationError);
  });
});

describe('allowExtraArgs consistency (issue #41)', () => {
  it('should reject allowExtraArgs=true without extraArgsSchema', () => {
    const config = {
      commands: [
        {
          name: 'git_log',
          description: 'Log',
          command: 'git',
          args: ['log'],
          allowExtraArgs: true,
        },
      ],
    };
    expect(() => parseConfig(config)).toThrow(ConfigValidationError);
  });

  it('should reject allowExtraArgs=false with extraArgsSchema present', () => {
    const config = {
      commands: [
        {
          name: 'git_log',
          description: 'Log',
          command: 'git',
          args: ['log'],
          allowExtraArgs: false,
          extraArgsSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'limit' },
            },
          },
        },
      ],
    };
    expect(() => parseConfig(config)).toThrow(ConfigValidationError);
  });

  it('should accept allowExtraArgs=true with extraArgsSchema', () => {
    expect(() => parseConfig(VALID_CONFIG_WITH_EXTRA_ARGS)).not.toThrow();
  });

  it('should accept allowExtraArgs=false without extraArgsSchema', () => {
    expect(() => parseConfig(VALID_CONFIG)).not.toThrow();
  });
});

describe('default-in-enum validation (issue #40)', () => {
  it('should reject default value not in enum', () => {
    const config = {
      commands: [
        {
          name: 'git_log',
          description: 'Log',
          command: 'git',
          args: ['log'],
          allowExtraArgs: true,
          extraArgsSchema: {
            type: 'object',
            properties: {
              format: {
                type: 'string',
                description: 'format',
                enum: ['oneline', 'short', 'full'],
                default: 'invalid',
              },
            },
          },
        },
      ],
    };
    expect(() => parseConfig(config)).toThrow(ConfigValidationError);
    try {
      parseConfig(config);
    } catch (err) {
      expect((err as ConfigValidationError).issues).toEqual(
        expect.arrayContaining([expect.stringContaining('not in enum')]),
      );
    }
  });

  it('should accept default value that is in enum', () => {
    const config = {
      commands: [
        {
          name: 'git_log',
          description: 'Log',
          command: 'git',
          args: ['log'],
          allowExtraArgs: true,
          extraArgsSchema: {
            type: 'object',
            properties: {
              format: {
                type: 'string',
                description: 'format',
                enum: ['oneline', 'short', 'full'],
                default: 'oneline',
              },
            },
          },
        },
      ],
    };
    expect(() => parseConfig(config)).not.toThrow();
  });

  it('should accept enum without default', () => {
    const config = {
      commands: [
        {
          name: 'git_log',
          description: 'Log',
          command: 'git',
          args: ['log'],
          allowExtraArgs: true,
          extraArgsSchema: {
            type: 'object',
            properties: {
              format: {
                type: 'string',
                description: 'format',
                enum: ['oneline', 'short'],
              },
            },
          },
        },
      ],
    };
    expect(() => parseConfig(config)).not.toThrow();
  });

  it('should reject number default not in number enum', () => {
    const config = {
      commands: [
        {
          name: 'git_log',
          description: 'Log',
          command: 'git',
          args: ['log'],
          allowExtraArgs: true,
          extraArgsSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'limit',
                enum: [5, 10, 25],
                default: 99,
              },
            },
          },
        },
      ],
    };
    expect(() => parseConfig(config)).toThrow(ConfigValidationError);
  });
});
