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
    // Email a ti mismo
    await transporter.sendMail({
      from: `"Portfolio Contact" <${process.env.MAIL_USER}>`,
      to: process.env.MAIL_USER,
      subject: `Nuevo mensaje de ${name}`,
      replyTo: email,
      text: `Nombre: ${name}\nEmail: ${email}\n\n${message}`
    });

    // Respuesta automática al usuario
    await transporter.sendMail({
      from: `"Portfolio Contact" <${process.env.MAIL_USER}>`,
      to: email,
      subject: 'Gracias por tu mensaje',
      text: `Hola ${name},\n\nGracias por tu mensaje. Nos pondremos en contacto contigo pronto.\n\nUn saludo\nSergio González`
    });

    console.log(`Mensaje enviado de ${name} <${email}>: ${message}`);
    res.json({ success: true, message: 'Message sent!' });
  } catch (err) {
    console.error('Error sending contact message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};
