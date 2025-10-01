
// Mailer disabled — replaced with a no-op to avoid SMTP usage on hosting.
// Calls to sendMail will be logged and resolved immediately.
function sendMail({ to, subject, text, html }) {
  console.log(`Mailer disabled. Would have sent to ${to} with subject: ${subject}`);
  return Promise.resolve({ mocked: true });
}

module.exports = { sendMail };
