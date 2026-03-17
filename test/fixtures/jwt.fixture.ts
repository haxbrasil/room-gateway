import { JwtService } from '@nestjs/jwt';

export const GATEWAY_JWT_SECRET = 'gateway-jwt-secret';
type GatewayJwtAlgorithm = 'HS256';

export const GATEWAY_JWT_ALGO: GatewayJwtAlgorithm = 'HS256';
export const GATEWAY_JWT_ISSUER = 'haxbrasil-gateway';
export const GATEWAY_JWT_AUDIENCE = 'haxbrasil-room-server';

type GatewayJwtPayload = Record<string, unknown>;
type GatewayJwtSignOptions = {
  secret: string;
  algorithm: GatewayJwtAlgorithm;
  issuer: string;
  audience: string;
};

type GatewayJwtConfigKey =
  | 'GATEWAY_JWT_PUBLIC_KEY'
  | 'GATEWAY_JWT_ALGO'
  | 'GATEWAY_JWT_ISS'
  | 'GATEWAY_JWT_AUD';

export function gatewayJwtSignOptions(
  overrides: Partial<GatewayJwtSignOptions> = {},
): GatewayJwtSignOptions {
  return {
    secret: GATEWAY_JWT_SECRET,
    algorithm: GATEWAY_JWT_ALGO,
    issuer: GATEWAY_JWT_ISSUER,
    audience: GATEWAY_JWT_AUDIENCE,
    ...overrides,
  };
}

export function signGatewayToken(
  jwtService: JwtService,
  payload: GatewayJwtPayload,
): string {
  return jwtService.sign(payload, gatewayJwtSignOptions());
}

export function gatewayJwtConfigValue(key: GatewayJwtConfigKey): string {
  switch (key) {
    case 'GATEWAY_JWT_PUBLIC_KEY':
      return GATEWAY_JWT_SECRET;
    case 'GATEWAY_JWT_ALGO':
      return GATEWAY_JWT_ALGO;
    case 'GATEWAY_JWT_ISS':
      return GATEWAY_JWT_ISSUER;
    case 'GATEWAY_JWT_AUD':
      return GATEWAY_JWT_AUDIENCE;
  }
}
