import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { buildRedisConnectionFromUrl } from './common/queue/redis-connection.util';
import { EnvSchema, validateEnv } from './env/env.schema';
import { RoomGatewayModule } from './modules/room-gateway/room-gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: validateEnv,
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvSchema, true>) => ({
        connection: buildRedisConnectionFromUrl(
          config.getOrThrow('REDIS_URL', { infer: true }),
        ),
      }),
    }),
    RoomGatewayModule,
  ],
})
export class AppModule {}
