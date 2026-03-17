import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EnvSchema } from '../../env/env.schema';
import { RoomServerClaims } from './types/room-server-claims.type';
import { parseRoomServerClaims } from './utils/room-server-claims.util';

@Injectable()
export class RoomGatewayAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvSchema, true>,
  ) {}

  validateAccessToken(token: string): RoomServerClaims | null {
    try {
      const payload = this.jwtService.verify<Record<string, unknown>>(token, {
        secret: this.config.getOrThrow('GATEWAY_JWT_PUBLIC_KEY', {
          infer: true,
        }),
        algorithms: [
          this.config.getOrThrow('GATEWAY_JWT_ALGO', { infer: true }),
        ],
        issuer: this.config.getOrThrow('GATEWAY_JWT_ISS', { infer: true }),
        audience: this.config.getOrThrow('GATEWAY_JWT_AUD', { infer: true }),
      });

      return parseRoomServerClaims(payload);
    } catch {
      return null;
    }
  }
}
