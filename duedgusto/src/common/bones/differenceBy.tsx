/* eslint-disable @typescript-eslint/no-explicit-any */
const differenceBy = (arr1: any[], arr2: any[], keyOrIterateeFunc: string | ((item: any) => any)) => {
  const iteratee = (typeof keyOrIterateeFunc === 'string') ? (item: any) => item[keyOrIterateeFunc] : keyOrIterateeFunc;
  return arr1.filter((objItem) => !arr2.map(iteratee).includes(iteratee(objItem)));
};

export default differenceBy;
