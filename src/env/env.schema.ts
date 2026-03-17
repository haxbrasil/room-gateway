import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  validateSync,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvSchema {
  @IsEnum(NodeEnv)
  NODE_ENV!: NodeEnv;

  @IsNumber()
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  @IsString()
  @IsNotEmpty()
  GATEWAY_JWT_PUBLIC_KEY!: string;

  @IsString()
  @IsNotEmpty()
  GATEWAY_JWT_ALGO!: string;

  @IsString()
  @IsNotEmpty()
  GATEWAY_JWT_ISS!: string;

  @IsString()
  @IsNotEmpty()
  GATEWAY_JWT_AUD!: string;
}

export function validateEnv(config: Record<string, unknown>): EnvSchema {
  const validated = plainToInstance(EnvSchema, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const formatted = errors
      .map((err) => Object.values(err.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment variables: ${formatted}`);
  }

  return validated;
}
