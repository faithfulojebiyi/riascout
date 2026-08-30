import { PayloadTooLargeException } from '@nestjs/common';
import { Command, CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { StorageService } from '@providers/storage/storage.service.js';
import { AlsService } from '@system/als/als.service.js';

import type {
  UploadImageDto,
  UploadImageResponseDto,
} from '../dto/onboarding.dto.js';
import { AVATAR_MAX_BYTES } from '../schema.js';
import { requireIdentity } from '../identity.js';

export class UploadImageCommand extends Command<UploadImageResponseDto> {
  constructor(public readonly dto: UploadImageDto) {
    super();
  }
}

@CommandHandler(UploadImageCommand)
export class UploadImageCommandHandler implements ICommandHandler<UploadImageCommand> {
  constructor(
    private readonly storageService: StorageService,
    private readonly alsService: AlsService,
  ) {}

  /**
   * Returns a url without attaching it to anything — the profile and workspace
   * steps save it, so an abandoned upload leaves no half-written record.
   */
  async execute({ dto }: UploadImageCommand): Promise<UploadImageResponseDto> {
    requireIdentity(this.alsService);

    const data = Buffer.from(dto.data, 'base64');

    if (data.byteLength > AVATAR_MAX_BYTES) {
      throw new PayloadTooLargeException(
        `Images are limited to ${AVATAR_MAX_BYTES / (1024 * 1024)}MB`,
      );
    }

    const url = await this.storageService.putImage(data, dto.contentType);

    return { url };
  }
}
