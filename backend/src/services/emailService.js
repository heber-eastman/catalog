const AWS = require('aws-sdk');

// Configure AWS SES
const ses = new AWS.SES({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

/**
 * Send confirmation email to new user
 * @param {string} email - Recipient email
 * @param {string} subdomain - Course subdomain
 * @param {string} token - Confirmation token
 * @returns {Promise<Object>} SES response or mock response
 */
async function sendConfirmationEmail(email, subdomain, token) {
      const confirmationUrl = `https://${subdomain}.catalog.golf/confirm?token=${token}`;

  const params = {
    Source: process.env.FROM_EMAIL || 'noreply@catalog.golf',
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Subject: {
        Data: 'Welcome to Golf Course Management - Confirm Your Account',
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: `
            <html>
              <body>
                <h2>Welcome to Golf Course Management!</h2>
                <p>Thank you for signing up. Please click the link below to confirm your account and activate your golf course management system:</p>
                <p><a href="${confirmationUrl}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px;">Confirm Account</a></p>
                <p>Or copy and paste this link into your browser:</p>
                <p>${confirmationUrl}</p>
                <p>This link will expire in 24 hours.</p>
                <p>If you didn't create this account, please ignore this email.</p>
                <br>
                <p>Best regards,<br>The Golf Course Management Team</p>
              </body>
            </html>
          `,
          Charset: 'UTF-8',
        },
        Text: {
          Data: `
Welcome to Golf Course Management!

Thank you for signing up. Please visit the following link to confirm your account and activate your golf course management system:

${confirmationUrl}

This link will expire in 24 hours.

If you didn't create this account, please ignore this email.

Best regards,
The Golf Course Management Team
          `,
          Charset: 'UTF-8',
        },
      },
    },
  };

  // In test or development environment, return mock response
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.NODE_ENV === 'development'
  ) {
    console.log('Development mode: Mocking email send');
    console.log('Email would be sent to:', email);
    console.log('Confirmation URL:', confirmationUrl);
    return {
      MessageId: 'mock-message-id',
      email,
      subdomain,
      token,
      confirmationUrl,
    };
  }

  try {
    const result = await ses.sendEmail(params).promise();
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send confirmation email');
  }
}

/**
 * Send generic email
 * @param {Object} emailData - Email parameters
 * @param {string} emailData.to - Recipient email
 * @param {string} emailData.subject - Email subject
 * @param {string} emailData.text - Plain text content
 * @param {string} emailData.html - HTML content
 * @returns {Promise<Object>} SES response or mock response
 */
async function sendEmail({ to, subject, text, html }) {
  const params = {
    Source: process.env.FROM_EMAIL || 'noreply@catalog.golf',
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: html,
          Charset: 'UTF-8',
        },
        Text: {
          Data: text,
          Charset: 'UTF-8',
        },
      },
    },
  };

  // In test or development environment, return mock response
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.NODE_ENV === 'development'
  ) {
    console.log('Development mode: Mocking email send');
    console.log('Email would be sent to:', to);
    console.log('Subject:', subject);
    return {
      MessageId: 'mock-message-id',
      to,
      subject,
      text,
      html,
    };
  }

  try {
    const result = await ses.sendEmail(params).promise();
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
}

module.exports = {
  sendConfirmationEmail,
  sendEmail,
};
