const { csvCell } = require('../dist/src/admin/exports.controller');

describe('Admin exports', () => {
  it('escapes commas, line breaks, and quotes in CSV cells', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('one,two')).toBe('"one,two"');
    expect(csvCell('say "hello"')).toBe('"say ""hello"""');
    expect(csvCell(null)).toBe('');
  });
});
