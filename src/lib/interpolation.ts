export function interpolate(template: string, variables: Record<string, any>): string {
  if (!template) return '';
  let result = template;

  result = result.replace(/\{!@variables\.(\w+)\}/g, (_, name) => {
    const v = variables[name];
    return v === undefined || v === null ? `[${name}]` : String(v);
  });

  result = result.replace(/@variables\.(\w+)/g, (_, name) => {
    const v = variables[name];
    return v === undefined || v === null ? `[${name}]` : String(v);
  });

  result = result.replace(/\{(\w+)\}/g, (match, name) => {
    const v = variables[name];
    return v === undefined || v === null ? match : String(v);
  });

  result = result.replace(/\$\{(\w+)\}/g, (match, name) => {
    const v = variables[name];
    return v === undefined || v === null ? match : String(v);
  });

  return result;
}

export function extractVariableNames(template: string): string[] {
  if (!template) return [];
  const vars = new Set<string>();
  for (const m of template.matchAll(/\{!@variables\.(\w+)\}/g)) vars.add(m[1]);
  for (const m of template.matchAll(/@variables\.(\w+)/g)) vars.add(m[1]);
  for (const m of template.matchAll(/\{(\w+)\}/g)) vars.add(m[1]);
  for (const m of template.matchAll(/\$\{(\w+)\}/g)) vars.add(m[1]);
  return Array.from(vars);
}
