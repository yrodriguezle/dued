function flatMap<T, U>(collection: T[] | { [key: string]: T }, callback: (value: T, key: string | number, collection: T[] | { [key: string]: T }) => U[]): U[] {
  if (Array.isArray(collection)) {
    // Se è un array, utilizza reduce per concatenare i risultati della callback
    return collection.reduce<U[]>((accumulator, currentValue, currentIndex, array) => {
      return accumulator.concat(callback(currentValue, currentIndex, array));
    }, []);
  } else {
    // Se è un oggetto, utilizza Object.keys per iterare sulle chiavi e concatenare i risultati della callback
    return Object.keys(collection).reduce<U[]>((accumulator, key) => {
      const value = collection[key];
      return accumulator.concat(callback(value, key, collection));
    }, []);
  }
}

export default flatMap;
