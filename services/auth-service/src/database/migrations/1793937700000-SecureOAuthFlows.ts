import { MigrationInterface, QueryRunner } from 'typeorm';
export class SecureOAuthFlows1793937700000 implements MigrationInterface {
  name = 'SecureOAuthFlows1793937700000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE UNIQUE INDEX "ux_external_accounts_user_provider" ON "external_accounts" ("user_id","provider")`,
    );
    await q.query(`CREATE TABLE "oauth_flows" ("id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "state_hash" varchar(64) NOT NULL, "binding_hash" varchar(64) NOT NULL, "provider" varchar(10) NOT NULL CHECK (provider IN ('google','github')),
      "nonce_hash" varchar(64) NOT NULL, "verifier_cipher" text NOT NULL, "expires_at" timestamptz NOT NULL,
      "consumed_at" timestamptz, "link_user_id" uuid REFERENCES users(id) ON DELETE RESTRICT,
      "user_id" uuid REFERENCES users(id) ON DELETE RESTRICT, "exchange_hash" varchar(64), "exchange_used_at" timestamptz)`);
    await q.query(
      `CREATE UNIQUE INDEX "ux_oauth_flows_state" ON "oauth_flows" ("state_hash")`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "ux_oauth_flows_exchange" ON "oauth_flows" ("exchange_hash")`,
    );
    await q.query(
      `CREATE INDEX "ix_oauth_flows_expiry" ON "oauth_flows" ("expires_at")`,
    );
  }
  async down(_q: QueryRunner): Promise<void> {
    throw new Error(
      'Destructive rollback blocked: preserve identities and flows.',
    );
  }
}
