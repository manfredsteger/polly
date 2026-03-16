import { describe, it, expect } from 'vitest';
import { parseTestCases } from '../../services/testRunnerService';

describe('parseTestCases', () => {
  it('should parse basic it() calls', () => {
    const content = `
      it('should do something', () => {});
      it("should do another thing", () => {});
    `;
    const result = parseTestCases(content);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('should do something');
    expect(result[1].name).toBe('should do another thing');
  });

  it('should parse basic test() calls', () => {
    const content = `
      test('first test', () => {});
      test("second test", () => {});
    `;
    const result = parseTestCases(content);
    expect(result).toHaveLength(2);
  });

  it('should parse template literal test names', () => {
    const content = "it(`should handle template literals`, () => {});";
    const result = parseTestCases(content);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('should handle template literals');
  });

  it('should skip single-line comments', () => {
    const content = `
      // it('this is commented out', () => {});
      it('this is real', () => {});
    `;
    const result = parseTestCases(content);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('this is real');
  });

  it('should skip block comments', () => {
    const content = `
      /* it('commented out', () => {}); */
      /*
        it('also commented', () => {});
        test('still commented', () => {});
      */
      it('real test', () => {});
    `;
    const result = parseTestCases(content);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('real test');
  });

  it('should handle it.skip and test.skip', () => {
    const content = `
      it.skip('skipped test', () => {});
      test.skip('another skipped', () => {});
    `;
    const result = parseTestCases(content);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('skipped test');
  });

  it('should handle it.todo', () => {
    const content = `
      it.todo('todo test');
    `;
    const result = parseTestCases(content);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('todo test');
  });

  it('should handle it.only and test.only', () => {
    const content = `
      it.only('focused test', () => {});
      test.only('another focused', () => {});
    `;
    const result = parseTestCases(content);
    expect(result).toHaveLength(2);
  });

  it('should detect it.each as a dynamic test', () => {
    const content = `
      it.each([1, 2, 3])('test case %i', (num) => {});
    `;
    const result = parseTestCases(content);
    expect(result).toHaveLength(1);
    expect(result[0].name).toContain('[dynamic]');
  });

  it('should detect test.each as a dynamic test', () => {
    const content = `
      test.each([[1, 2], [3, 4]])('adds %i + %i', (a, b) => {});
    `;
    const result = parseTestCases(content);
    expect(result).toHaveLength(1);
    expect(result[0].name).toContain('[dynamic]');
  });

  it('should handle mixed real and commented tests', () => {
    const content = `
      describe('my suite', () => {
        it('test one', () => {});
        // it('commented test', () => {});
        /* it('block commented', () => {}); */
        it('test two', () => {});
      });
    `;
    const result = parseTestCases(content);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('test one');
    expect(result[1].name).toBe('test two');
  });

  it('should not count describe blocks as tests', () => {
    const content = `
      describe('suite', () => {
        it('test inside', () => {});
      });
    `;
    const result = parseTestCases(content);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('test inside');
  });

  it('should return empty array for files with no tests', () => {
    const content = `
      const helper = () => {};
      export default helper;
    `;
    const result = parseTestCases(content);
    expect(result).toHaveLength(0);
  });

  it('should handle multi-line block comments correctly', () => {
    const content = `
      it('before comment', () => {});
      /*
       * This is a big comment block
       * it('fake test inside comment', () => {});
       * test('another fake', () => {});
       */
      it('after comment', () => {});
    `;
    const result = parseTestCases(content);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('before comment');
    expect(result[1].name).toBe('after comment');
  });

  it('should detect forEach-generated tests', () => {
    const content = `
      const cases = ['a', 'b', 'c'];
      cases.forEach((c) => {
        it('should handle ' + c, () => {});
      });
    `;
    const result = parseTestCases(content);
    const forEachTests = result.filter(t => t.name.includes('[dynamic/forEach]'));
    expect(forEachTests.length).toBeGreaterThanOrEqual(1);
  });

  it('should detect forEach with arrow function', () => {
    const content = `
      [1, 2, 3].forEach(num => {
        test('test case for ' + num, () => {});
      });
    `;
    const result = parseTestCases(content);
    const forEachTests = result.filter(t => t.name.includes('[dynamic/forEach]'));
    expect(forEachTests.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle forEach with destructured params', () => {
    const content = `
      testCases.forEach(({ input, expected }) => {
        it('validates input correctly', () => {
          expect(validate(input)).toBe(expected);
        });
      });
    `;
    const result = parseTestCases(content);
    const forEachTests = result.filter(t => t.name.includes('[dynamic/forEach]'));
    expect(forEachTests.length).toBeGreaterThanOrEqual(1);
  });
});
