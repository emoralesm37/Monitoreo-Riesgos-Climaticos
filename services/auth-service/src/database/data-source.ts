import { databaseSchema } from './schema';
import { ExternalAccount } from '../auth/entities/external-account.entity';
import { OAuthFlow } from '../auth/oauth/oauth-flow.entity';
import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { Role } from '../roles/entities/role.entity';
import { User } from '../users/entities/user.entity';

config();

const requiredVariables = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
];

for (const variable of requiredVariables) {
  if (!process.env[variable]) {
    throw new Error(
      `La variable de entorno ${variable} es obligatoria.`,
    );
  }
}

export default new DataSource({
  type: 'postgres',
  schema: databaseSchema(process.env.DB_SCHEMA),
  extra: {options: '-c search_path='+databaseSchema(process.env.DB_SCHEMA)+',public'},
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  entities: [User, Role, RefreshToken, ExternalAccount, OAuthFlow],

  migrations: [
    `${__dirname}/migrations/*{.ts,.js}`,
  ],
  migrationsTableName: 'typeorm_migrations',

  synchronize: false,
  migrationsRun: false,

  ssl:
    process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
});