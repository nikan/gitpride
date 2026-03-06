import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { ToolRegistry } from '../../src/server/registry.js';

// Suppress logger output during tests
vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

function makeServer(): McpServer {
  return new McpServer({ name: 'test-server', version: '0.0.1' }, { capabilities: { tools: {} } });
}

describe('ToolRegistry', () => {
  let server: McpServer;
  let registry: ToolRegistry;

  beforeEach(() => {
    server = makeServer();
    registry = new ToolRegistry(server);
  });

  it('should register a tool and track it', () => {
    registry.register({
      name: 'echo',
      description: 'Echo input back',
      inputSchema: { text: z.string() },
      handler: async ({ text }) => ({
        content: [{ type: 'text', text }],
      }),
    });

    expect(registry.has('echo')).toBe(true);
    expect(registry.size).toBe(1);
    expect(registry.toolNames).toEqual(['echo']);
  });

  it('should reject duplicate tool names', () => {
    const def = {
      name: 'dup',
      description: 'Duplicate',
      inputSchema: {},
      handler: async () => ({ content: [{ type: 'text' as const, text: 'ok' }] }),
    };
    registry.register(def);
    expect(() => registry.register(def)).toThrow(/already registered/);
  });

  it('should register multiple tools via registerAll', () => {
    registry.registerAll([
      {
        name: 'a',
        description: 'A',
        inputSchema: {},
        handler: async () => ({ content: [{ type: 'text' as const, text: 'a' }] }),
      },
      {
        name: 'b',
        description: 'B',
        inputSchema: {},
        handler: async () => ({ content: [{ type: 'text' as const, text: 'b' }] }),
      },
    ]);
    expect(registry.size).toBe(2);
    expect(registry.has('a')).toBe(true);
    expect(registry.has('b')).toBe(true);
  });

  it('should report false for unregistered tools', () => {
    expect(registry.has('nonexistent')).toBe(false);
  });
});
