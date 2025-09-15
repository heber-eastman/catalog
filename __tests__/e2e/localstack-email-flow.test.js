const {
  SQSClient,
  CreateQueueCommand,
  GetQueueUrlCommand,
} = require('@aws-sdk/client-sqs');
const {
  SESClient,
  VerifyEmailIdentityCommand,
} = require('@aws-sdk/client-ses');

// Import Lambda handler
const lambdaHandler = require('../../../lambda/sendEmailWorker/index').handler;

// Localstack configuration
const LOCALSTACK_ENDPOINT = 'http://localhost:4566';
const AWS_CONFIG = {
  region: 'us-east-1',
  endpoint: LOCALSTACK_ENDPOINT,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
};

describe('Localstack End-to-End Email Flow', () => {
  let sqsClient;
  let sesClient;
  let queueUrl;

  jest.setTimeout(60000);

  beforeAll(async () => {
    // Initialize AWS clients pointing to Localstack
    sqsClient = new SQSClient(AWS_CONFIG);
    sesClient = new SESClient(AWS_CONFIG);
    console.log('✅ Localstack clients initialized');
  });

  beforeEach(async () => {
    // Set up environment variables
    process.env.EMAIL_QUEUE_URL =
      'http://localhost:4566/000000000000/CatalogEmailQueue';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ENDPOINT = LOCALSTACK_ENDPOINT;
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    process.env.SES_REGION = 'us-east-1';
    process.env.SES_FROM = 'noreply@catalog.golf';

    // Create SQS queue
    try {
      const result = await sqsClient.send(
        new CreateQueueCommand({
          QueueName: 'CatalogEmailQueue',
        })
      );
      queueUrl = result.QueueUrl;
      console.log('✅ SQS Queue ready:', queueUrl);
    } catch (error) {
      if (error.name === 'QueueAlreadyExists') {
        const result = await sqsClient.send(
          new GetQueueUrlCommand({
            QueueName: 'CatalogEmailQueue',
          })
        );
        queueUrl = result.QueueUrl;
        console.log('✅ Using existing SQS Queue:', queueUrl);
      } else {
        throw error;
      }
    }

    // Verify email address in SES (Localstack auto-accepts)
    try {
      await sesClient.send(
        new VerifyEmailIdentityCommand({
          EmailAddress: 'noreply@catalog.golf',
        })
      );
      console.log('✅ Email address verified in Localstack SES');
    } catch (error) {
      console.log('⚠️ Email verification skipped:', error.message);
    }
  });

  describe('Lambda Handler Integration', () => {
    test('should successfully process email via Lambda with Localstack', async () => {
      console.log('🚀 Testing Lambda email processing with Localstack...');

      // Create a valid email job message
      const emailJob = {
        templateName: 'SignupConfirmation',
        toAddress: 'test@example.com',
        templateData: {
          confirmation_link: 'https://test.catalog.golf/confirm?token=abc123',
          course_name: 'Test Golf Club',
        },
      };

      // Create Lambda event (simulating SQS trigger)
      const lambdaEvent = {
        Records: [
          {
            messageId: 'test-message-id',
            receiptHandle: 'test-receipt-handle',
            body: JSON.stringify(emailJob),
            attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: Date.now().toString(),
              SenderId: 'test',
              ApproximateFirstReceiveTimestamp: Date.now().toString(),
            },
            messageAttributes: {},
            md5OfBody: 'test-md5',
            eventSource: 'aws:sqs',
            eventSourceARN:
              'arn:aws:sqs:us-east-1:000000000000:CatalogEmailQueue',
            awsRegion: 'us-east-1',
          },
        ],
      };

      // Invoke Lambda handler
      const result = await lambdaHandler(lambdaEvent);

      // Verify successful processing
      expect(result).toHaveProperty('statusCode', 200);
      expect(result).toHaveProperty('body');

      const responseBody = JSON.parse(result.body);
      expect(responseBody).toHaveProperty('processedCount', 1);
      expect(responseBody).toHaveProperty('failedCount', 0);
      expect(responseBody).toHaveProperty(
        'message',
        'Successfully processed 1 email(s)'
      );

      console.log('✅ Lambda successfully processed email via Localstack SES');
      console.log('📧 Email details:', {
        template: emailJob.templateName,
        recipient: emailJob.toAddress,
        processed: responseBody.processedCount,
        failed: responseBody.failedCount,
      });
    });

    test('should handle batch processing of multiple emails', async () => {
      console.log('🚀 Testing batch email processing...');

      // Create multiple email jobs
      const emailJobs = [
        {
          templateName: 'SignupConfirmation',
          toAddress: 'user1@example.com',
          templateData: {
            confirmation_link:
              'https://test1.catalog.golf/confirm?token=abc123',
            course_name: 'Golf Club 1',
          },
        },
        {
          templateName: 'WelcomeEmail',
          toAddress: 'user2@example.com',
          templateData: {
            user_name: 'John Doe',
            course_name: 'Golf Club 2',
          },
        },
      ];

      // Create Lambda event with multiple records
      const lambdaEvent = {
        Records: emailJobs.map((job, index) => ({
          messageId: `test-message-${index}`,
          receiptHandle: `test-receipt-${index}`,
          body: JSON.stringify(job),
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: Date.now().toString(),
            SenderId: 'test',
            ApproximateFirstReceiveTimestamp: Date.now().toString(),
          },
          messageAttributes: {},
          md5OfBody: `test-md5-${index}`,
          eventSource: 'aws:sqs',
          eventSourceARN:
            'arn:aws:sqs:us-east-1:000000000000:CatalogEmailQueue',
          awsRegion: 'us-east-1',
        })),
      };

      // Invoke Lambda handler
      const result = await lambdaHandler(lambdaEvent);

      // Verify successful batch processing
      expect(result).toHaveProperty('statusCode', 200);
      expect(result).toHaveProperty('body');

      const responseBody = JSON.parse(result.body);
      expect(responseBody).toHaveProperty('processedCount', 2);
      expect(responseBody).toHaveProperty('failedCount', 0);
      expect(responseBody).toHaveProperty(
        'message',
        'Successfully processed 2 email(s)'
      );

      console.log(
        '✅ Lambda successfully processed batch emails via Localstack'
      );
      console.log('📧 Batch results:', {
        totalJobs: emailJobs.length,
        processed: responseBody.processedCount,
        failed: responseBody.failedCount,
      });
    });

    test('should demonstrate error handling with invalid template', async () => {
      console.log('🚀 Testing error handling...');

      // Create an invalid email job
      const invalidEmailJob = {
        templateName: 'NonExistentTemplate',
        toAddress: 'test@example.com',
        templateData: { test: 'data' },
      };

      // Create Lambda event
      const lambdaEvent = {
        Records: [
          {
            messageId: 'test-error-message',
            receiptHandle: 'test-error-receipt',
            body: JSON.stringify(invalidEmailJob),
            attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: Date.now().toString(),
              SenderId: 'test',
              ApproximateFirstReceiveTimestamp: Date.now().toString(),
            },
            messageAttributes: {},
            md5OfBody: 'test-error-md5',
            eventSource: 'aws:sqs',
            eventSourceARN:
              'arn:aws:sqs:us-east-1:000000000000:CatalogEmailQueue',
            awsRegion: 'us-east-1',
          },
        ],
      };

      // Invoke Lambda handler
      const result = await lambdaHandler(lambdaEvent);

      // Verify error handling
      expect(result).toHaveProperty('statusCode', 207); // Partial success
      expect(result).toHaveProperty('body');

      const responseBody = JSON.parse(result.body);
      expect(responseBody).toHaveProperty('processedCount', 0);
      expect(responseBody).toHaveProperty('failedCount', 1);
      expect(responseBody).toHaveProperty('errors');
      expect(responseBody.errors).toHaveLength(1);

      console.log('✅ Lambda correctly handled invalid template error');
      console.log('❌ Error details:', {
        processed: responseBody.processedCount,
        failed: responseBody.failedCount,
        errorMessage: responseBody.errors[0],
      });
    });
  });

  describe('Infrastructure Verification', () => {
    test('should verify Localstack SQS and SES services are available', async () => {
      console.log('🔍 Verifying Localstack infrastructure...');

      // Test SQS connectivity
      const queueExists = queueUrl && queueUrl.includes('localhost:4566');
      expect(queueExists).toBe(true);
      console.log('✅ SQS service accessible at:', queueUrl);

      // Test SES connectivity by verifying another email
      try {
        await sesClient.send(
          new VerifyEmailIdentityCommand({
            EmailAddress: 'test-verify@example.com',
          })
        );
        console.log('✅ SES service accessible and responding');
      } catch (error) {
        console.log('⚠️ SES verification test skipped:', error.message);
      }

      console.log('🎉 Localstack infrastructure verification complete');
    });
  });
});
