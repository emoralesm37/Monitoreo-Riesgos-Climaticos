import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'oauth_flows' })
@Index('ux_oauth_flows_state', ['stateHash'], { unique: true })
@Index('ux_oauth_flows_exchange', ['exchangeHash'], { unique: true })
export class OAuthFlow {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'state_hash', type: 'varchar', length: 64 })
  stateHash!: string;
  @Column({ name: 'binding_hash', type: 'varchar', length: 64 })
  bindingHash!: string;
  @Column({ type: 'varchar', length: 10 }) provider!: string;
  @Column({ name: 'nonce_hash', type: 'varchar', length: 64 })
  nonceHash!: string;
  @Column({ name: 'verifier_cipher', type: 'text' }) verifierCipher!: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;
  @Column({ name: 'link_user_id', type: 'uuid', nullable: true }) linkUserId!:
    string | null;
  @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId!:
    string | null;
  @Column({
    name: 'exchange_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  exchangeHash!: string | null;
  @Column({ name: 'exchange_used_at', type: 'timestamptz', nullable: true })
  exchangeUsedAt!: Date | null;
}
