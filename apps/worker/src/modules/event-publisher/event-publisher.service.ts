import { Injectable } from '@nestjs/common';
import { Inngest } from 'inngest';

import type { EventUserDto } from '@system/queues/dto/events.dto.js';
import { EVENTS } from '@system/queues/events.config.js';

/**
 * Module-level singleton: the client reads INNGEST_DEV at construction, which
 * is why load-env must be the first import in main.ts. Otherwise the SDK starts
 * in cloud mode and rejects the dev server with "Expected server kind cloud".
 */
export const inngest = new Inngest({ id: 'worker' });

type EventName = (typeof EVENTS)[keyof typeof EVENTS]['event'];

type EventByName<N extends EventName> = {
  [K in keyof typeof EVENTS]: (typeof EVENTS)[K] extends { event: N }
    ? (typeof EVENTS)[K]
    : never;
}[keyof typeof EVENTS];

type EventData<N extends EventName> =
  EventByName<N> extends {
    create(data: infer D, ...args: unknown[]): unknown;
  }
    ? D
    : never;

/** user is supplied separately, so a caller cannot forget to attach identity */
type SendData<N extends EventName> = Omit<EventData<N>, 'user'>;

type SendEventArgs<N extends EventName> = {
  id?: string;
  name: N;
  data: SendData<N>;
  user: EventUserDto;
  ts?: number;
};

@Injectable()
export class EventPublisherService {
  async sendEvent<N extends EventName>({
    id,
    name,
    data,
    user,
    ts,
  }: SendEventArgs<N>) {
    return inngest.send({ id, name, data: { ...data, user }, ts });
  }

  async sendEventBatch<N extends EventName>(batch: SendEventArgs<N>[]) {
    return inngest.send(
      batch.map(({ id, name, data, user }) => ({
        id,
        name,
        data: { ...data, user },
      })),
    );
  }
}
