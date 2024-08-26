import nodemailer from "nodemailer";
import { OAuth2Client } from "google-auth-library";

// Validate environment variables
const requiredEnvVars = [
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REDIRECT_URI",
  "GMAIL_REFRESH_TOKEN",
  "EMAIL_USER",
  "EMAIL_FROM",
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`Environment variable ${envVar} is not defined`);
  }
});

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private oAuth2Client: OAuth2Client;

  constructor() {
    this.oAuth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID!,
      process.env.GMAIL_CLIENT_SECRET!,
      process.env.GMAIL_REDIRECT_URI!
    );

    this.oAuth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
    });

    this.initializeTransporter();
  }

  private async initializeTransporter() {
    try {
      const accessToken = await this.oAuth2Client.getAccessToken();
      if (accessToken.token) {
        this.transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            type: "OAuth2",
            user: process.env.EMAIL_USER!,
            clientId: process.env.GMAIL_CLIENT_ID!,
            clientSecret: process.env.GMAIL_CLIENT_SECRET!,
            refreshToken: process.env.GMAIL_REFRESH_TOKEN!,
            accessToken: accessToken.token,
          },
        });
      } else {
        throw new Error("Failed to get access token");
      }
    } catch (error) {
      console.error("Error initializing email transporter:", error);
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    console.log("Attempting to send email:", { to, subject });

    const mailOptions = {
      from: process.env.EMAIL_FROM || "clickcrateofficial@gmail.com",
      to,
      subject,
      html,
    };

    try {
      if (!this.transporter) {
        await this.initializeTransporter();
      }

      if (!this.transporter) {
        throw new Error("Failed to initialize email transporter");
      }

      await this.transporter.sendMail(mailOptions);
      console.log(`Email sent to ${to}`);
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }

  async sendVerificationEmail(
    to: string,
    verificationCode: string
  ): Promise<void> {
    const subject = "ClickCrate Product Creation Verification";
    const html = `
      <h1>ClickCrate Product Creation Verification</h1>
      <p>Your verification code is: <strong>${verificationCode}</strong></p>
      <p>Please enter this code to complete your product creation process.</p>
    `;

    await this.sendEmail(to, subject, html);
  }
}

export const emailService = new EmailService();

export function sendVerificationEmail(to: string, verificationCode: string) {
  return emailService.sendVerificationEmail(to, verificationCode);
}
