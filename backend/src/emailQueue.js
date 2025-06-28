const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

// Valid template names that we support
const VALID_TEMPLATES = [
  'SignupConfirmation',
  'WelcomeEmail',
  'StaffInvitation',
  'SuperAdminInvitation',
];

/**
 * Validates the input parameters for enqueueEmail
 * @param {string} templateName - The email template name
 * @param {string} toAddress - The recipient email address
 * @param {Object} templateData - The template data object
 * @throws {Error} If validation fails
 */
function validateInput(templateName, toAddress, templateData) {
  // Check required parameters
  if (!templateName || templateName.trim() === '') {
    throw new Error('templateName is required');
  }

  if (!toAddress || toAddress.trim() === '') {
    throw new Error('toAddress is required');
  }

  if (!templateData) {
    throw new Error('templateData is required');
  }

  // Validate template name
  if (!VALID_TEMPLATES.includes(templateName)) {
    throw new Error(
      `Invalid template name: ${templateName}. Valid templates: ${VALID_TEMPLATES.join(', ')}`
    );
  }
}

/**
 * Validates required environment variables
 * @throws {Error} If required environment variables are missing
 */
function validateEnvironment() {
  if (!process.env.EMAIL_QUEUE_URL) {
    throw new Error('EMAIL_QUEUE_URL environment variable is required');
  }

  if (!process.env.AWS_REGION) {
    throw new Error('AWS_REGION environment variable is required');
  }
}

/**
 * Enqueues an email job to the SQS queue for processing by the Lambda function
 * @param {string} templateName - The name of the SES template to use
 * @param {string} toAddress - The recipient email address
 * @param {Object} templateData - The data to populate the email template
 * @returns {Promise<Object>} The SQS response containing MessageId and MD5OfBody
 * @throws {Error} If validation fails or SQS operation fails
 */
async function enqueueEmail(templateName, toAddress, templateData) {
  console.log(`Enqueuing email: ${templateName} to ${toAddress}`);

  // Validate input parameters
  validateInput(templateName, toAddress, templateData);

  // Validate environment variables
  validateEnvironment();

  // Initialize SQS client
  const sqsClientConfig = {
    region: process.env.AWS_REGION,
  };

  // Support custom endpoint for Localstack testing
  if (process.env.AWS_ENDPOINT) {
    sqsClientConfig.endpoint = process.env.AWS_ENDPOINT;
    sqsClientConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    };
  }

  const sqsClient = new SQSClient(sqsClientConfig);

  // Create the email job payload
  const emailJob = {
    templateName,
    toAddress,
    templateData,
  };

  // Create the SQS command
  const command = new SendMessageCommand({
    QueueUrl: process.env.EMAIL_QUEUE_URL,
    MessageBody: JSON.stringify(emailJob),
  });

  try {
    // Send the message to SQS
    const result = await sqsClient.send(command);
    console.log(
      `Email job enqueued successfully. MessageId: ${result.MessageId}`
    );
    return result;
  } catch (error) {
    console.error(`Failed to enqueue email job: ${error.message}`, {
      templateName,
      toAddress,
      error: error.stack,
    });

    // Re-throw the error to allow caller to handle it
    throw error;
  }
}

module.exports = {
  enqueueEmail,
};
