// ── Public API ──

/** Extract the first validation error per field from a Zod issues array. */
export function extractFieldErrors<K extends string>(
  issues: ReadonlyArray<{ path?: ReadonlyArray<PropertyKey>; message: string }>,
  validFields: readonly K[],
): Partial<Record<K, string>> {
  const errors: Partial<Record<K, string>> = {};
  for (const issue of issues) {
    const field = issue.path?.[0];
    if (validFields.includes(field as K)) {
      const key = field as K;
      errors[key] = errors[key] ?? issue.message;
    }
  }
  return errors;
}
