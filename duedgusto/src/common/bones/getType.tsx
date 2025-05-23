function getType(obj: unknown): string {
  return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
}

export default getType;
