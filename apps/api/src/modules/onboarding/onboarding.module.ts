import { Module } from '@nestjs/common';

import { StorageModule } from '@providers/storage/storage.module.js';

// plop:imports
import { CompleteOnboardingCommandHandler } from './commands/complete-onboarding.js';
import { InviteTeammatesCommandHandler } from './commands/invite-teammates.js';
import { SavePreferencesCommandHandler } from './commands/save-preferences.js';
import { SaveProfileCommandHandler } from './commands/save-profile.js';
import { SaveWorkspaceCommandHandler } from './commands/save-workspace.js';
import { UploadImageCommandHandler } from './commands/upload-image.js';
import { GetOnboardingStateQueryHandler } from './queries/get-onboarding-state.js';
import { OnboardingController } from './onboarding.controller.js';

@Module({
  imports: [StorageModule],
  controllers: [OnboardingController],
  providers: [
    // plop:providers
    CompleteOnboardingCommandHandler,
    InviteTeammatesCommandHandler,
    SavePreferencesCommandHandler,
    SaveProfileCommandHandler,
    SaveWorkspaceCommandHandler,
    UploadImageCommandHandler,
    GetOnboardingStateQueryHandler,
  ],
})
export class OnboardingModule {}
