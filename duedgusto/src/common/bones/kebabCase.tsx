function kebabCase(input: string): string {
  return input
    .replace(/([a-z])([A-Z])/g, '$1-$2') // Convert camelCase to kebab-case
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[_]+/g, '-') // Replace underscores with hyphens
    .replace(/[^a-zA-Z0-9-]+/g, '') // Remove non-alphanumeric and non-hyphen characters
    .toLowerCase(); // Convert to lowercase
}

export default kebabCase;
