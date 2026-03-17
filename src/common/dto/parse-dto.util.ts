import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

export function parseDto<T extends object>(
  value: unknown,
  dtoClass: new () => T,
): T | null {
  const parsed = plainToInstance(dtoClass, value);
  const validationErrors = validateSync(parsed, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (validationErrors.length > 0) {
    return null;
  }

  return parsed;
}
