

function keyBy<T,>(collection: T[], key: keyof T) {
  if (!Array.isArray(collection)) {
    throw new Error('collection must be an array');
  }
  return (collection || []).reduce((accumulator, item) => {
    if (typeof item[key] !== 'string' && typeof item[key] !== 'number') {
      throw new Error('key must be a string, number');
    }
    const valueOfKey = (item[key] as string | number).toString();
    return ({ ...accumulator, [valueOfKey]: item });
  }, {} as { [k: string]: T });
}

export default keyBy;
