import type { NotificationProvider, EmailMessage } from "./notification.interface";

export class ConsoleAdapter implements NotificationProvider {
  async send(message: EmailMessage): Promise<void> {
    console.log("\n📧 [DEV EMAIL] ─────────────────────────────");
    console.log(`To:      ${message.to}`);
    console.log(`Subject: ${message.subject}`);
    console.log("─────────────────────────────────────────────");
    // Strip style/script blocks then HTML tags for readable terminal output
    const text = message.html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    console.log(text.slice(0, 500) + (text.length > 500 ? "…" : ""));
    console.log("─────────────────────────────────────────────\n");
  }
}
