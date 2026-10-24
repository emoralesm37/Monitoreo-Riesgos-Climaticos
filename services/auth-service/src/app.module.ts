import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module';
import { RefreshToken } from './auth/entities/refresh-token.entity';
import { HealthModule } from './health/health.module';
import { Role } from './roles/entities/role.entity';
import { RolesModule } from './roles/roles.module';
import { User } from './users/entities/user.entity';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.getOrThrow<string>('DB_HOST'),
        port: Number(
          configService.getOrThrow<string>('DB_PORT'),
        ),
        database:
          configService.getOrThrow<string>('DB_NAME'),
        username:
          configService.getOrThrow<string>('DB_USER'),
        password:
          configService.getOrThrow<string>('DB_PASSWORD'),

        entities: [User, Role, RefreshToken],

        synchronize: false,
        migrationsRun: false,

        ssl:
          configService.get<string>('DB_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,

        retryAttempts: 5,
        retryDelay: 3000,
      }),
    }),

    AuthModule,
    UsersModule,
    RolesModule,
    HealthModule,
  ],
})
export class AppModule {}