import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { RoomGatewayService as RoomGatewayServiceEnum } from '../../src/modules/room-gateway/enums/room-gateway-service.enum';
import { RoomGatewayAuthService } from '../../src/modules/room-gateway/room-gateway-auth.service';
import {
  GATEWAY_JWT_SECRET,
  gatewayJwtConfigValue,
  gatewayJwtSignOptions,
  signGatewayToken,
} from '../fixtures/jwt.fixture';
import { roomServerClaimsFixture } from '../fixtures/room-gateway.fixture';

describe('RoomGatewayAuthService (e2e)', () => {
  let service: RoomGatewayAuthService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        JwtService,
        RoomGatewayAuthService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: gatewayJwtConfigValue,
          },
        },
      ],
    }).compile();

    service = moduleRef.get(RoomGatewayAuthService);
    jwtService = moduleRef.get(JwtService);
  });

  it('accepts a valid room-server token', () => {
    const claims = roomServerClaimsFixture();
    const token = signGatewayToken(jwtService, claims);

    expect(service.validateAccessToken(token)).toEqual({
      tenant: claims.tenant,
      service: RoomGatewayServiceEnum.ROOM_SERVER,
      server_id: claims.server_id,
    });
  });

  it('rejects malformed token', () => {
    expect(service.validateAccessToken('invalid.token.value')).toBeNull();
  });

  it('rejects token signed with wrong secret', () => {
    const token = jwtService.sign(roomServerClaimsFixture(), {
      ...gatewayJwtSignOptions({
        secret: 'another-secret',
      }),
    });

    expect(service.validateAccessToken(token)).toBeNull();
  });

  it('rejects token with wrong issuer', () => {
    const token = jwtService.sign(roomServerClaimsFixture(), {
      ...gatewayJwtSignOptions({
        secret: GATEWAY_JWT_SECRET,
        issuer: 'unexpected-issuer',
      }),
    });

    expect(service.validateAccessToken(token)).toBeNull();
  });

  it('rejects token with wrong audience', () => {
    const token = jwtService.sign(roomServerClaimsFixture(), {
      ...gatewayJwtSignOptions({
        secret: GATEWAY_JWT_SECRET,
        audience: 'unexpected-audience',
      }),
    });

    expect(service.validateAccessToken(token)).toBeNull();
  });

  it('rejects token with unsupported service claim', () => {
    const token = signGatewayToken(jwtService, {
      tenant: 'tenant-a',
      service: 'api',
      server_id: '00000000-0000-4000-8000-000000000001',
    });

    expect(service.validateAccessToken(token)).toBeNull();
  });

  it('rejects token with missing tenant claim', () => {
    const token = signGatewayToken(jwtService, {
      service: RoomGatewayServiceEnum.ROOM_SERVER,
      server_id: '00000000-0000-4000-8000-000000000001',
    });

    expect(service.validateAccessToken(token)).toBeNull();
  });

  it('rejects token with missing server_id claim', () => {
    const token = signGatewayToken(jwtService, {
      tenant: 'tenant-a',
      service: RoomGatewayServiceEnum.ROOM_SERVER,
    });

    expect(service.validateAccessToken(token)).toBeNull();
  });
});
