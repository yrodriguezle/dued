import { describe, expect, it } from "vitest";
import getType from "../getType";

describe('getType', () => {
  it('should return `number`', () => {
    const expected = 'number';
    expect(getType(...[1])).toBe(expected);
  });
  it('should return `string`', () => {
    const expected = 'string';
    expect(getType(...[''])).toBe(expected);
  });
  it('should return `boolean`', () => {
    const expected = 'boolean';
    expect(getType(...[true])).toBe(expected);
  });
  it('should return `null`', () => {
    const expected = 'null';
    expect(getType(...[null])).toBe(expected);
  });
  it('should return `function`', () => {
    const expected = 'function';
    expect(getType(...[() => { }])).toBe(expected);
  });
  it('should return `date`', () => {
    const expected = 'date';
    expect(getType(...[new Date()])).toBe(expected);
  });
  it('should return `array`', () => {
    const expected = 'array';
    expect(getType(...[[]])).toBe(expected);
  });
  it('should return `object`', () => {
    const expected = 'object';
    expect(getType(...[{}])).toBe(expected);
  });
});
