export function isObjectWithFields<TField extends string>(
  value: unknown,
  ...fields: TField[]
): value is Record<TField, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return fields.every((field) => Object.hasOwn(value, field));
}

export function getOptionalStringField(
  value: unknown,
  field: string,
): string | null {
  if (!isObjectWithFields(value, field)) {
    return null;
  }

  return typeof value[field] === 'string' ? value[field] : null;
}
