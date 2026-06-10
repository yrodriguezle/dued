function uniq<T>(target: T[] = []): T[] {
  return [...new Set(target)];
}

export default uniq;
