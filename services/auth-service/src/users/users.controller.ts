import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ChangeUserStatusRequestDto } from './dto/change-user-status-request.dto';
import { CreateUserRequestDto } from './dto/create-user-request.dto';
import { UpdateUserRequestDto } from './dto/update-user-request.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Get()
  findAll(): Promise<UserResponseDto[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  findById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserResponseDto> {
    return this.usersService.findById(id);
  }

  @Post()
  create(
    @Body() request: CreateUserRequestDto,
  ): Promise<UserResponseDto> {
    return this.usersService.create(request);
  }

  @Patch(':id/status')
  changeStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() request: ChangeUserStatusRequestDto,
  ): Promise<UserResponseDto> {
    return this.usersService.changeStatus(id, request);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() request: UpdateUserRequestDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, request);
  }
}