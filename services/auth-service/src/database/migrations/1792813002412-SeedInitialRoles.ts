import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class SeedInitialRoles1792813002412
  implements MigrationInterface
{
  name = 'SeedInitialRoles1792813002412';

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "roles"
        ("id", "name", "description")
      VALUES
        (
          '00000000-0000-4000-8000-000000000001',
          'Administrador',
          'Acceso completo a la administración del sistema'
        ),
        (
          '00000000-0000-4000-8000-000000000002',
          'Operador',
          'Acceso operativo al monitoreo y consulta del sistema'
        )
      ON CONFLICT ("name") DO NOTHING;
    `);
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "roles"
      WHERE "id" IN (
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002'
      );
    `);
  }
}