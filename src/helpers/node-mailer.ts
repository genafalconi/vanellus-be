import { createTransport } from 'nodemailer';
import * as dotenv from 'dotenv';
import { MailDataDto } from 'src/data/client.dto';
dotenv.config({ path: '.env' });

const transporter = createTransport({
  service: "Gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_MAIL,
    pass: process.env.SMTP_KEY,
  },
});

export const sendEmail = async (mailData: MailDataDto) => {
  try {
    const mailOptions = {
      from: mailData.from,
      to: mailData.to,
      subject: mailData.subject,
      html: mailData.text,
      attachments: mailData.attachments || []
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
};
