function getType(obj: unknown): string {
  return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
}

function defaultValue(value: unknown): string | number | null | undefined | false {
  switch (getType(value)) {
  case "number":
    return 0;
  case "string":
    return "";
  case "boolean":
    return false;
  case "date":
  case "null":
    return null;
  default:
    return undefined;
  }
}

export default defaultValue;
