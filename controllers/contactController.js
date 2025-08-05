const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

exports.handleContact = async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    // Email to me
    await transporter.sendMail({
      from: `"Portfolio Contact" <${process.env.MAIL_USER}>`,
      to: process.env.MAIL_USER,
      subject: `New message from ${name}`,
      replyTo: email,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`
    });

    // Automatic reply to user
    await transporter.sendMail({
      from: `"Portfolio Contact" <${process.env.MAIL_USER}>`,
      to: email,
      subject: 'Thanks for contacting me!',
      text: `Hi ${name},\n\nThanks for your message. We'll get back to you soon.\n\nBest regards,\nSergio González`
    });

    console.log(`Message sent from ${name} <${email}>: ${message}`);
    res.json({ success: true, message: 'Message sent!' });
  } catch (err) {
    console.error('Error sending contact message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};
