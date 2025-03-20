import { describe, expect, it } from "vitest";
import omitDeep from "../omitDeep";

describe('omitDeep', () => {
  it('should omit properties in object in deep', () => {
    const input = [
      {
        a: {
          b: {
            c: {
              d: {
                f: { _typename: 'OmitType' },
                array1: [{ a: { _typename: 'OmitType' } }],
                array2: [{ b: { _typename: 'OmitType' } }],
              },
            },
          },
        },
      },
      ['_typename'],
    ];
    const expected = {
      a: {
        b: {
          c: {
            d: {
              f: {},
              array1: [{ a: {} }],
              array2: [{ b: {} }],
            },
          },
        },
      },
    };
    expect(omitDeep(input[0], ['_typename'])).toEqual(expected);
  });
  it('should omit properties in object in deep', () => {
    const input = [
      {
        uirecent: {
          iDUIRecent: 0,
          uIRecentType: 0,
          iDUIFunction: 1,
          iDUIWorkspace: undefined,
          userID: 71,
        },
      },
      ['_typename'],
    ];
    const expected = {
      uirecent: {
        iDUIRecent: 0,
        uIRecentType: 0,
        iDUIFunction: 1,
        iDUIWorkspace: undefined,
        userID: 71,
      },
    };
    expect(omitDeep(input[0], ['_typename'])).toEqual(expected);
  });
});
