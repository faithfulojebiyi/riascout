export type MailAddress = string;

export type MailEnvelope = {
  from: MailAddress;
  to: MailAddress | MailAddress[];
  subject: string;
  replyTo?: MailAddress;
  /**
   * `<event-type>/<entity-id>`. Per-provider, 24h, 256 chars — it stops a retry
   * against the same transport duplicating, and does nothing across two.
   */
  idempotencyKey?: string;
};

/** the union is what guarantees at least one body at the type level */
export type MailMessage = MailEnvelope &
  ({ html: string; text?: string } | { text: string; html?: string });

/**
 * Declared rather than assumed, so the envelope can carry something a transport
 * cannot do and be refused instead of silently dropping it.
 */
export type MailCapabilities = {
  attachments: boolean;
  scheduling: boolean;
  tags: boolean;
};

export type MailSendResult = {
  transport: string;
  /** the provider's message id, when it returns one */
  id?: string;
};

export type MailTransport = {
  readonly name: string;
  readonly capabilities: MailCapabilities;
  send(message: MailMessage): Promise<MailSendResult>;
};
