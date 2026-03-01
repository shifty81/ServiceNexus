/**
 * Route helpers unit tests
 */

const { emitEvent, validateRequired, safeJsonParse } = require('./utils/routeHelpers');

describe('routeHelpers', () => {
  describe('emitEvent', () => {
    test('should emit event when io is available', () => {
      const mockIo = { emit: jest.fn() };
      const req = { app: { get: jest.fn().mockReturnValue(mockIo) } };
      emitEvent(req, 'test-event', { id: '1' });
      expect(mockIo.emit).toHaveBeenCalledWith('test-event', { id: '1' });
    });

    test('should not throw when io is not available', () => {
      const req = { app: { get: jest.fn().mockReturnValue(null) } };
      expect(() => emitEvent(req, 'test-event', {})).not.toThrow();
    });
  });

  describe('validateRequired', () => {
    test('should return null when all fields present', () => {
      expect(validateRequired({ name: 'Test', email: 'a@b.com' }, ['name', 'email'])).toBeNull();
    });

    test('should return error for missing field', () => {
      expect(validateRequired({ name: 'Test' }, ['name', 'email'])).toBe('email is required');
    });

    test('should return error for empty string field', () => {
      expect(validateRequired({ name: '' }, ['name'])).toBe('name is required');
    });

    test('should return error for null field', () => {
      expect(validateRequired({ name: null }, ['name'])).toBe('name is required');
    });
  });

  describe('safeJsonParse', () => {
    test('should parse valid JSON', () => {
      expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
    });

    test('should return fallback for invalid JSON', () => {
      expect(safeJsonParse('not json', [])).toEqual([]);
    });

    test('should return null fallback by default', () => {
      expect(safeJsonParse('bad')).toBeNull();
    });

    test('should parse arrays', () => {
      expect(safeJsonParse('[1,2,3]')).toEqual([1, 2, 3]);
    });
  });
});
