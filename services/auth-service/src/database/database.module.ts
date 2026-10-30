import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Role } from '../roles/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { DatabaseSeederService } from './database-seeder.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, User]),
  ],
  providers: [DatabaseSeederService],
})
export class DatabaseModule {}