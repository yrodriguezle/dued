const differenceBy = <T, K>(arr1: T[], arr2: T[], keyOrIterateeFunc: keyof T | ((item: T) => K)): T[] => {
  const iteratee: (item: T) => unknown = typeof keyOrIterateeFunc === "function" ? keyOrIterateeFunc : (item: T) => item[keyOrIterateeFunc];
  return arr1.filter((objItem) => !arr2.map(iteratee).includes(iteratee(objItem)));
};

export default differenceBy;
