/* eslint-disable @typescript-eslint/no-explicit-any */

function uniq(target: any[] = []): any[] {
  return [...new Set(target)];
}

export default uniq;
