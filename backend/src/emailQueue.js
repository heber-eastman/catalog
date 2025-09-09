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
 * Creates a promise that rejects after the specified timeout
 * @param {number} ms - Timeout in milliseconds
 * @returns {Promise} Promise that rejects with timeout error
 */
function timeoutPromise(ms) {
  let timeoutId;
  const promise = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`Operation timed out after ${ms}ms`)),
      ms
    );
  });

  // Attach cleanup function to the promise
  promise.clearTimeout = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };

  return promise;
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
  // Short-circuit in test/disabled environments
  if (
    process.env.DISABLE_EMAIL_QUEUE === 'true'
  ) {
    console.log(`Email queue disabled; mocking enqueue for ${toAddress}`);
    return { MessageId: 'mock-message-id', MD5OfBody: 'mock' };
  }
  // Validate input parameters
  validateInput(templateName, toAddress, templateData);

  // Validate environment variables
  validateEnvironment();

  try {
    console.log(`Enqueuing email: ${templateName} to ${toAddress}`);

    // Initialize SQS client with timeout configuration
    const sqsClientConfig = {
      region: process.env.AWS_REGION,
      requestHandler: {
        requestTimeout: 10000, // 10 second timeout for SQS requests
        connectionTimeout: 5000, // 5 second connection timeout
      },
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

    const command = new SendMessageCommand({
      QueueUrl: process.env.EMAIL_QUEUE_URL,
      MessageBody: JSON.stringify({
        templateName,
        toAddress,
        templateData,
      }),
    });

    // Create timeout promise with cleanup capability
    const timeout = timeoutPromise(15000);
    const sqsPromise = sqsClient.send(command);

    let result;
    try {
      result = await Promise.race([sqsPromise, timeout]);
      // Clear the timeout since the operation completed successfully
      timeout.clearTimeout();
    } catch (error) {
      // Clear the timeout on error as well
      timeout.clearTimeout();
      throw error;
    }

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

/**
 * Enqueues an email job without blocking the calling operation
 * Logs errors but doesn't throw them to prevent blocking critical operations
 * @param {string} templateName - The name of the SES template to use
 * @param {string} toAddress - The recipient email address
 * @param {Object} templateData - The data to populate the email template
 * @returns {Promise<void>} Resolves when email is queued or fails silently
 */
async function enqueueEmailNonBlocking(templateName, toAddress, templateData) {
  // Short-circuit in test/disabled environments
  if (
    process.env.DISABLE_EMAIL_QUEUE === 'true'
  ) {
    console.log(`Email queue disabled; skipping non-blocking enqueue for ${toAddress}`);
    return;
  }
  try {
    await enqueueEmail(templateName, toAddress, templateData);
    console.log(`Email successfully queued for ${toAddress}`);
  } catch (error) {
    console.error(
      `Email queue operation failed for ${toAddress}, but continuing with request:`,
      {
        templateName,
        toAddress,
        error: error.message,
      }
    );
    // Don't throw - allow the calling operation to continue
  }
}

module.exports = {
  enqueueEmail,
  enqueueEmailNonBlocking,
};
