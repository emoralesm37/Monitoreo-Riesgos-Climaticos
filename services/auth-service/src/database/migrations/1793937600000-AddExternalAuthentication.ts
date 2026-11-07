import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExternalAuthentication1793937600000 implements MigrationInterface {
  name = 'AddExternalAuthentication1793937600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "password_hash" DROP NOT NULL
    `);

    await queryRunner.query(`
      INSERT INTO "roles"
        ("id", "name", "description")
      VALUES (
        '00000000-0000-4000-8000-000000000003',
        'Viewer',
        'Consulta de monitoreo sin permisos administrativos'
      )
      ON CONFLICT ("name") DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE "external_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "provider" varchar(30) NOT NULL,
        "provider_user_id" varchar(255) NOT NULL,
        "user_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_external_accounts"
          PRIMARY KEY ("id"),
        CONSTRAINT "FK_external_accounts_user"
          FOREIGN KEY ("user_id")
          REFERENCES "users"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX
        "ux_external_accounts_provider_user"
      ON "external_accounts"
        ("provider", "provider_user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_external_accounts_user_id"
      ON "external_accounts" ("user_id")
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error(
      'Rollback destructivo bloqueado: preservar cuentas externas y usuarios existentes.',
    );
  }
}
