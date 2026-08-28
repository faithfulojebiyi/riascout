import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import type { AlsContext } from './als.types.js';

@Injectable()
export class AlsService {
  constructor(readonly ctx: ClsService<AlsContext>) {}
}
