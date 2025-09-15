const { SESClient, SendTemplatedEmailCommand } = require('@aws-sdk/client-ses');

// Valid template names that we support
const VALID_TEMPLATES = [
  'SignupConfirmation',
  'WelcomeEmail',
  'StaffInvitation',
  'SuperAdminInvitation',
];

// Simple email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates the email job payload
 * @param {Object} payload - The email job payload
 * @throws {Error} If validation fails
 */
function validateEmailJob(payload) {
  // Check required fields
  if (!payload.templateName) {
    throw new Error('templateName is required');
  }

  if (!payload.toAddress) {
    throw new Error('toAddress is required');
  }

  if (!payload.templateData) {
    throw new Error('templateData is required');
  }

  // Validate template name
  if (!VALID_TEMPLATES.includes(payload.templateName)) {
    throw new Error(
      `Invalid template name: ${payload.templateName}. Valid templates: ${VALID_TEMPLATES.join(', ')}`
    );
  }

  // Validate email format
  if (!EMAIL_REGEX.test(payload.toAddress)) {
    throw new Error(`Invalid email address format: ${payload.toAddress}`);
  }
}

/**
 * Validates required environment variables
 * @throws {Error} If required environment variables are missing
 */
function validateEnvironment() {
  if (!process.env.SES_REGION) {
    throw new Error('SES_REGION environment variable is required');
  }

  if (!process.env.SES_FROM) {
    throw new Error('SES_FROM environment variable is required');
  }
}

/**
 * Processes a single email job by sending it via SES
 * @param {Object} sesClient - The SES client instance
 * @param {Object} emailJob - The email job payload
 */
async function processEmailJob(sesClient, emailJob) {
  console.log(
    `Processing email job: ${emailJob.templateName} to ${emailJob.toAddress}`
  );

  const command = new SendTemplatedEmailCommand({
    Source: process.env.SES_FROM,
    Destination: {
      ToAddresses: [emailJob.toAddress],
    },
    Template: emailJob.templateName,
    TemplateData: JSON.stringify(emailJob.templateData),
  });

  try {
    const result = await sesClient.send(command);
    console.log(`Email sent successfully. MessageId: ${result.MessageId}`);
    return result;
  } catch (error) {
    console.error(`Failed to send email: ${error.message}`);
    throw error;
  }
}

/**
 * AWS Lambda handler for processing email jobs from SQS
 * @param {Object} event - The Lambda event containing SQS records
 * @returns {Promise<void>}
 */
exports.handler = async event => {
  console.log(`Processing ${event.Records.length} email job(s)`);

  // Validate environment variables once
  validateEnvironment();

  // Initialize SES client
  const sesClientConfig = {
    region: process.env.SES_REGION,
  };

  // Support custom endpoint for Localstack testing
  if (process.env.AWS_ENDPOINT) {
    sesClientConfig.endpoint = process.env.AWS_ENDPOINT;
    sesClientConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    };
  }

  const sesClient = new SESClient(sesClientConfig);

  // Process each SQS record
  const promises = event.Records.map(async record => {
    try {
      // Parse the SQS message body
      const emailJob = JSON.parse(record.body);

      // Validate the email job payload
      validateEmailJob(emailJob);

      // Process the email job
      await processEmailJob(sesClient, emailJob);
    } catch (error) {
      console.error(`Failed to process record: ${error.message}`, {
        record: record.body,
        error: error.stack,
      });

      // Re-throw the error to trigger SQS retry mechanism
      throw error;
    }
  });

  // Wait for all email jobs to complete
  // If any fail, the entire batch will be retried by SQS
  await Promise.all(promises);

  console.log(`Successfully processed ${event.Records.length} email job(s)`);
};
