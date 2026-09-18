import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Genuinely missing piece flagged during the full spec audit: nothing in
 * the system sent an email anywhere. That made three features silently
 * incomplete — password reset (needs a reset link), retention policy's
 * NOTIFY_ONLY action (logged to audit_logs but nobody was told), and
 * researcher access-request approval (approved but the researcher never
 * finds out except by checking the portal themselves).
 *
 * If SMTP_HOST isn't configured, this logs to console instead of
 * throwing — keeps local dev working without a real mail server, but
 * every call site should still treat delivery as best-effort.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly transporter = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : null;

  async send(to: string, subject: string, html: string) {
    if (!this.transporter) {
      this.logger.warn(`SMTP not configured — email not sent. To: ${to} | Subject: ${subject}`);
      return;
    }
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM ?? 'no-reply@hbj-archive.local',
        to,
        subject,
        html,
      });
    } catch (err) {
      // Never let a notification failure break the actual request/job —
      // same principle as AuditService.
      this.logger.error(`Failed to send email to ${to}`, err as Error);
    }
  }

  sendPasswordReset(to: string, resetUrl: string) {
    return this.send(
      to,
      'إعادة تعيين كلمة المرور — HBJ Archive',
      `<p>وصلنا طلب لإعادة تعيين كلمة المرور بتاعتك.</p>
       <p><a href="${resetUrl}">اضغطي هنا لإعادة التعيين</a> (صالح لمدة ساعة).</p>
       <p>لو ما طلبتيش ده، تجاهلي الرسالة دي.</p>`,
    );
  }

  sendAccessRequestApproved(to: string, contentTitle: string) {
    return this.send(
      to,
      'تمت الموافقة على طلب الوصول — HBJ Archive',
      `<p>تمت الموافقة على طلب وصولك لعنصر: <strong>${contentTitle}</strong>.</p>
       <p>تقدري تشوفيه دلوقتي من بوابة الباحث.</p>`,
    );
  }

  sendRetentionNotice(to: string, contentTitle: string, expiryDate: Date) {
    return this.send(
      to,
      'تنبيه انتهاء مدة الاحتفاظ — HBJ Archive',
      `<p>العنصر <strong>${contentTitle}</strong> وصل لتاريخ انتهاء مدة الاحتفاظ المحدد (${expiryDate.toLocaleDateString('ar-EG')}).</p>`,
    );
  }
}
