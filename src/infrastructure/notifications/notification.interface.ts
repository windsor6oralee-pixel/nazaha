export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface NotificationProvider {
  send(message: EmailMessage): Promise<void>;
  // true when the adapter actually hands the message to a mail transport.
  // false for stub adapters (e.g. Console) that only log it locally.
  readonly isTransport: boolean;
}
