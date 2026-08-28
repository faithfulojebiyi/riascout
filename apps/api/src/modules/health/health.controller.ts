import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  // shallow: no dependencies. container probes use THIS one.
  @Get()
  check(): { status: 'ok'; service: string } {
    return { status: 'ok', service: 'api' };
  }

  // deep: pings dependencies. never wire this to a container probe.
  @Get('deep')
  deepCheck(): { status: 'ok'; checks: Record<string, string> } {
    return { status: 'ok', checks: {} };
  }
}
