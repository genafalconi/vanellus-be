import { createTransport } from 'nodemailer';
import * as dotenv from 'dotenv';
import { MailDataDto } from 'src/data/client.dto';
dotenv.config({ path: '.env' });

const transporter = createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  auth: {
    user: 'fantomcsb@gmail.com',
    pass: process.env.SMTP_MAILER,
  },
});

export const sendEmail = async (mailData: MailDataDto) => {
  const mailOptions = {
    from: mailData.from,
    to: mailData.to,
    subject: mailData.subject,
    text: mailData.text,
  };

  await transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
    return info.response;
  });
};
