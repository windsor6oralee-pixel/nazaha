export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface NotificationProvider {
  send(message: EmailMessage): Promise<void>;
}
