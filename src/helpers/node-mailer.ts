import { createTransport } from 'nodemailer';
import * as dotenv from 'dotenv';
import { MailDataDto } from 'src/data/client.dto';
dotenv.config({ path: '.env' });

const transporter = createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  auth: {
    user: process.env.SMTP_MAIL,
    pass: process.env.SMTP_MAILER,
  },
});

export const sendEmail = async (mailData: MailDataDto) => {
  try {
    const mailOptions = {
      from: mailData.from,
      to: mailData.to,
      subject: mailData.subject,
      text: mailData.text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
};
