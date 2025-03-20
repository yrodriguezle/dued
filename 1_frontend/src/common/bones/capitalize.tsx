function capitalize(target: string): string {
  const matches = target.match(/\b(\w)/);
  if (matches) {
    return target.replace(/\b(\w)/, matches[0].toUpperCase());
  }
  return `${target.charAt(0).toUpperCase()}${target.slice(1)}`;
}

export default capitalize;
