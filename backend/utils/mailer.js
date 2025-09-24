
const nodemailer = require('nodemailer');

// Debug: Log environment variables
console.log('GMAIL_USER:', process.env.GMAIL_USER);
console.log('GMAIL_PASS:', process.env.GMAIL_PASS ? '[HIDDEN]' : 'undefined');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER, // Your Gmail address
    pass: process.env.GMAIL_PASS  // Your Gmail app password
  }
});

function sendMail({ to, subject, text, html }) {
  console.log('Sending email to:', to);
  return transporter.sendMail({
    from: process.env.GMAIL_USER,
    to,
    subject,
    text,
    html
  })
  .then(info => {
    console.log('Email sent:', info.response);
    return info;
  })
  .catch(error => {
    console.error('Email send error:', error);
    throw error;
  });
}

module.exports = { sendMail };
