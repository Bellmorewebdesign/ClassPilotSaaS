import { describe, expect, it } from 'vitest';
import { safeMongoUri } from './logger.js';

describe('safeMongoUri', () => {
  it('drops credentials from an Atlas connection string', () => {
    const safe = safeMongoUri(
      'mongodb+srv://classpilot:sup3rs3cret@cluster0.abcde.mongodb.net/classpilot?retryWrites=true',
    );
    expect(safe).not.toContain('sup3rs3cret');
    expect(safe).not.toContain('classpilot:');
    expect(safe).toContain('cluster0.abcde.mongodb.net');
  });

  it('keeps a credential-free URI readable', () => {
    expect(safeMongoUri('mongodb://localhost:27017/classpilot')).toBe(
      'mongodb://localhost:27017/classpilot',
    );
  });

  it('never throws on an unparseable URI', () => {
    expect(safeMongoUri('nonsense')).toBe('<unparseable mongodb uri>');
  });
});
