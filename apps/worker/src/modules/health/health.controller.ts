import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  // shallow: no dependencies. container probes use THIS one.
  @Get()
  check(): { status: 'ok'; service: string } {
    return { status: 'ok', service: 'worker' };
  }
}
