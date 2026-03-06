import { describe, it, expect } from 'vitest';
import { SERVER_NAME, SERVER_VERSION } from '../src/index.js';

describe('smoke tests', () => {
  it('should export the server name', () => {
    expect(SERVER_NAME).toBe('gitpride');
  });

  it('should export a valid semver version', () => {
    expect(SERVER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
