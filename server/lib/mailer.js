const nodemailer = require('nodemailer');
const { stripCrlf } = require('./sanitize');

function createMailer(env = process.env, transporter) {
  transporter ??= nodemailer.createTransport({
    host: env.MAIL_HOST,
    port: Number(env.MAIL_PORT),
    secure: env.MAIL_SECURE === 'true',
    auth: {
      user: env.MAIL_USER,
      pass: env.MAIL_PASS
    }
  });

  return {
    verify: () => transporter.verify(),

    // Notification to the site owner. Name and email are stripped of CR/LF
    // before reaching any header; replyTo carries the bare address only so a
    // crafted display name can never smuggle headers.
    sendContactMail({ name, email, message }) {
      const safeName = stripCrlf(name);
      const safeEmail = stripCrlf(email);
      return transporter.sendMail({
        from: `"Portfolio Contact" <${env.MAIL_USER}>`,
        to: env.MAIL_ADMIN_USER || env.MAIL_USER,
        subject: `New message from ${safeName}`,
        replyTo: safeEmail,
        text: `Name: ${safeName}\nEmail: ${safeEmail}\n\n${message}`
      });
    },

    sendAutoReply({ name, email }) {
      const safeName = stripCrlf(name);
      return transporter.sendMail({
        from: `"Sergio - elbiti.com" <${env.MAIL_USER}>`,
        to: stripCrlf(email),
        subject: 'Thanks for contacting me!',
        text: `Hi ${safeName},\n\nThanks for your message. I'll get back to you soon.\n\nBest,\nSergio`
      });
    }
  };
}

module.exports = { createMailer };
