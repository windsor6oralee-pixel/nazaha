import type { NotificationProvider, EmailMessage } from "./notification.interface";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export class SmtpAdapter implements NotificationProvider {
  private config: SmtpConfig;
  // nodemailer is imported lazily so it doesn't load in dev (ConsoleAdapter path)
  private transporter: import("nodemailer").Transporter | null = null;

  constructor(config: SmtpConfig) {
    this.config = config;
  }

  private async getTransporter() {
    if (this.transporter) return this.transporter;
    const nodemailer = await import("nodemailer");
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: { user: this.config.user, pass: this.config.pass },
    });
    return this.transporter;
  }

  async send(message: EmailMessage): Promise<void> {
    const transporter = await this.getTransporter();
    await transporter.sendMail({
      from: this.config.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
    });
  }
}
