// Plugin hosts may forward optional settings as empty or unexpanded placeholders.
export function optionalLimit(value: string | undefined, name: string): string | undefined {
  if (value === undefined || value.trim() === '' || value === '${' + name + '}') return undefined;
  return value;
}
