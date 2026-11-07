import { databaseSchema } from './database/schema';
import { ExternalAccount } from './auth/entities/external-account.entity';
import { OAuthFlow } from './auth/oauth/oauth-flow.entity';
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
import { DatabaseModule } from './database/database.module';

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
        schema: databaseSchema(configService.get<string>('DB_SCHEMA')),
        extra: {options: '-c search_path='+databaseSchema(configService.get<string>('DB_SCHEMA'))+',public'},
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

        entities: [User, Role, RefreshToken, ExternalAccount, OAuthFlow],

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

    DatabaseModule,
    AuthModule,
    UsersModule,
    RolesModule,
    HealthModule,
  ],
})
export class AppModule {}