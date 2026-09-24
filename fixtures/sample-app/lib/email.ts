import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);
export async function sendWelcome(to: string) {
  await resend.emails.send({ from: 'Acme <onboarding@resend.dev>', to, subject: 'Welcome', html: '<p>hi</p>' });
}
