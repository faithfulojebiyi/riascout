import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { CompleteOnboardingCommand } from './commands/complete-onboarding.js';
import { InviteTeammatesCommand } from './commands/invite-teammates.js';
import { SavePreferencesCommand } from './commands/save-preferences.js';
import { SaveProfileCommand } from './commands/save-profile.js';
import { SaveWorkspaceCommand } from './commands/save-workspace.js';
import { UploadImageCommand } from './commands/upload-image.js';
import {
  CompleteOnboardingResponseDto,
  InviteTeammatesDto,
  InviteTeammatesResponseDto,
  OnboardingStateDto,
  SavePreferencesDto,
  SaveProfileDto,
  SaveWorkspaceDto,
  UploadImageDto,
  UploadImageResponseDto,
} from './dto/onboarding.dto.js';
import { GetOnboardingStateQuery } from './queries/get-onboarding-state.js';

/**
 * One route per wizard step rather than a single submit, so leaving halfway
 * keeps what was already answered.
 */
@ApiTags('Onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @ZodResponse({ type: OnboardingStateDto })
  @Get()
  async getState() {
    return this.queryBus.execute(new GetOnboardingStateQuery());
  }

  @Patch('profile')
  async saveProfile(@Body() dto: SaveProfileDto) {
    await this.commandBus.execute(new SaveProfileCommand(dto));
  }

  @Patch('workspace')
  async saveWorkspace(@Body() dto: SaveWorkspaceDto) {
    await this.commandBus.execute(new SaveWorkspaceCommand(dto));
  }

  @Patch('preferences')
  async savePreferences(@Body() dto: SavePreferencesDto) {
    await this.commandBus.execute(new SavePreferencesCommand(dto));
  }

  @ZodResponse({ type: InviteTeammatesResponseDto })
  @Post('invites')
  async inviteTeammates(@Body() dto: InviteTeammatesDto) {
    return this.commandBus.execute(new InviteTeammatesCommand(dto));
  }

  @ZodResponse({ type: UploadImageResponseDto })
  @Post('images')
  async uploadImage(@Body() dto: UploadImageDto) {
    return this.commandBus.execute(new UploadImageCommand(dto));
  }

  @ZodResponse({ type: CompleteOnboardingResponseDto })
  @Post('complete')
  async complete() {
    return this.commandBus.execute(new CompleteOnboardingCommand());
  }
}
