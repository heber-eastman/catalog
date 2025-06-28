const { enqueueEmail } = require('../../src/emailQueue');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

// Mock the AWS SDK
jest.mock('@aws-sdk/client-sqs');

describe('enqueueEmail Utility', () => {
  let mockSend;
  let mockSQSClient;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Create mock send method
    mockSend = jest.fn();

    // Mock SQSClient constructor and instance
    mockSQSClient = {
      send: mockSend,
    };
    SQSClient.mockImplementation(() => mockSQSClient);
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.EMAIL_QUEUE_URL;
    delete process.env.AWS_REGION;
  });

  describe('Successful message sending', () => {
    beforeEach(() => {
      // Set up environment variables
      process.env.EMAIL_QUEUE_URL =
        'https://sqs.us-east-1.amazonaws.com/123456789012/CatalogEmailQueue';
      process.env.AWS_REGION = 'us-east-1';

      // Mock successful SQS response
      mockSend.mockResolvedValue({
        MessageId: 'test-message-id-123',
        MD5OfBody: 'test-md5-hash',
      });
    });

    test('should enqueue SignupConfirmation email successfully', async () => {
      const templateName = 'SignupConfirmation';
      const toAddress = 'user@example.com';
      const templateData = {
        course_name: 'Pine Valley Golf Club',
        confirmation_link: 'https://app.catalog.golf/confirm?token=abc123',
      };

      const result = await enqueueEmail(templateName, toAddress, templateData);

      expect(result).toEqual({
        MessageId: 'test-message-id-123',
        MD5OfBody: 'test-md5-hash',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(expect.any(SendMessageCommand));

      // Verify the command was created with correct parameters
      expect(SendMessageCommand).toHaveBeenCalledWith({
        QueueUrl:
          'https://sqs.us-east-1.amazonaws.com/123456789012/CatalogEmailQueue',
        MessageBody: JSON.stringify({
          templateName: 'SignupConfirmation',
          toAddress: 'user@example.com',
          templateData: {
            course_name: 'Pine Valley Golf Club',
            confirmation_link: 'https://app.catalog.golf/confirm?token=abc123',
          },
        }),
      });
    });

    test('should enqueue WelcomeEmail successfully', async () => {
      const templateName = 'WelcomeEmail';
      const toAddress = 'newuser@example.com';
      const templateData = {
        user_name: 'John Doe',
        course_name: 'Augusta National',
      };

      await enqueueEmail(templateName, toAddress, templateData);

      expect(SendMessageCommand).toHaveBeenCalledWith({
        QueueUrl:
          'https://sqs.us-east-1.amazonaws.com/123456789012/CatalogEmailQueue',
        MessageBody: JSON.stringify({
          templateName: 'WelcomeEmail',
          toAddress: 'newuser@example.com',
          templateData: {
            user_name: 'John Doe',
            course_name: 'Augusta National',
          },
        }),
      });
    });

    test('should enqueue StaffInvitation successfully', async () => {
      const templateName = 'StaffInvitation';
      const toAddress = 'staff@example.com';
      const templateData = {
        invitation_link: 'https://app.catalog.golf/staff/accept?token=xyz789',
        course_name: 'Pebble Beach',
      };

      await enqueueEmail(templateName, toAddress, templateData);

      expect(SendMessageCommand).toHaveBeenCalledWith({
        QueueUrl:
          'https://sqs.us-east-1.amazonaws.com/123456789012/CatalogEmailQueue',
        MessageBody: JSON.stringify({
          templateName: 'StaffInvitation',
          toAddress: 'staff@example.com',
          templateData: {
            invitation_link:
              'https://app.catalog.golf/staff/accept?token=xyz789',
            course_name: 'Pebble Beach',
          },
        }),
      });
    });

    test('should enqueue SuperAdminInvitation successfully', async () => {
      const templateName = 'SuperAdminInvitation';
      const toAddress = 'admin@example.com';
      const templateData = {
        invitation_link:
          'https://app.catalog.golf/super-admin/accept?token=def456',
      };

      await enqueueEmail(templateName, toAddress, templateData);

      expect(SendMessageCommand).toHaveBeenCalledWith({
        QueueUrl:
          'https://sqs.us-east-1.amazonaws.com/123456789012/CatalogEmailQueue',
        MessageBody: JSON.stringify({
          templateName: 'SuperAdminInvitation',
          toAddress: 'admin@example.com',
          templateData: {
            invitation_link:
              'https://app.catalog.golf/super-admin/accept?token=def456',
          },
        }),
      });
    });

    test('should handle complex template data', async () => {
      const templateData = {
        user_name: 'Jane Smith',
        course_name: 'St. Andrews',
        confirmation_link: 'https://app.catalog.golf/confirm?token=complex123',
        additional_info: {
          nested: 'data',
          array: [1, 2, 3],
        },
      };

      await enqueueEmail(
        'SignupConfirmation',
        'jane@example.com',
        templateData
      );

      const expectedMessageBody = JSON.stringify({
        templateName: 'SignupConfirmation',
        toAddress: 'jane@example.com',
        templateData,
      });

      expect(SendMessageCommand).toHaveBeenCalledWith({
        QueueUrl:
          'https://sqs.us-east-1.amazonaws.com/123456789012/CatalogEmailQueue',
        MessageBody: expectedMessageBody,
      });
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      process.env.EMAIL_QUEUE_URL =
        'https://sqs.us-east-1.amazonaws.com/123456789012/CatalogEmailQueue';
      process.env.AWS_REGION = 'us-east-1';
    });

    test('should throw error when SQS send fails', async () => {
      const sqsError = new Error('SQS service unavailable');
      mockSend.mockRejectedValue(sqsError);

      await expect(
        enqueueEmail('SignupConfirmation', 'user@example.com', { test: 'data' })
      ).rejects.toThrow('SQS service unavailable');

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test('should throw error when EMAIL_QUEUE_URL is not set', async () => {
      delete process.env.EMAIL_QUEUE_URL;

      await expect(
        enqueueEmail('SignupConfirmation', 'user@example.com', { test: 'data' })
      ).rejects.toThrow('EMAIL_QUEUE_URL environment variable is required');

      expect(mockSend).not.toHaveBeenCalled();
    });

    test('should throw error when AWS_REGION is not set', async () => {
      delete process.env.AWS_REGION;

      await expect(
        enqueueEmail('SignupConfirmation', 'user@example.com', { test: 'data' })
      ).rejects.toThrow('AWS_REGION environment variable is required');

      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('Input validation', () => {
    beforeEach(() => {
      process.env.EMAIL_QUEUE_URL =
        'https://sqs.us-east-1.amazonaws.com/123456789012/CatalogEmailQueue';
      process.env.AWS_REGION = 'us-east-1';
      mockSend.mockResolvedValue({ MessageId: 'test-id' });
    });

    test('should throw error when templateName is missing', async () => {
      await expect(
        enqueueEmail(null, 'user@example.com', { test: 'data' })
      ).rejects.toThrow('templateName is required');

      expect(mockSend).not.toHaveBeenCalled();
    });

    test('should throw error when toAddress is missing', async () => {
      await expect(
        enqueueEmail('SignupConfirmation', null, { test: 'data' })
      ).rejects.toThrow('toAddress is required');

      expect(mockSend).not.toHaveBeenCalled();
    });

    test('should throw error when templateData is missing', async () => {
      await expect(
        enqueueEmail('SignupConfirmation', 'user@example.com', null)
      ).rejects.toThrow('templateData is required');

      expect(mockSend).not.toHaveBeenCalled();
    });

    test('should throw error when templateName is empty string', async () => {
      await expect(
        enqueueEmail('', 'user@example.com', { test: 'data' })
      ).rejects.toThrow('templateName is required');

      expect(mockSend).not.toHaveBeenCalled();
    });

    test('should throw error when toAddress is empty string', async () => {
      await expect(
        enqueueEmail('SignupConfirmation', '', { test: 'data' })
      ).rejects.toThrow('toAddress is required');

      expect(mockSend).not.toHaveBeenCalled();
    });

    test('should validate template name against allowed values', async () => {
      const validTemplates = [
        'SignupConfirmation',
        'WelcomeEmail',
        'StaffInvitation',
        'SuperAdminInvitation',
      ];

      // Test valid templates
      for (const template of validTemplates) {
        await expect(
          enqueueEmail(template, 'user@example.com', { test: 'data' })
        ).resolves.toBeDefined();
      }

      // Test invalid template
      await expect(
        enqueueEmail('InvalidTemplate', 'user@example.com', { test: 'data' })
      ).rejects.toThrow('Invalid template name: InvalidTemplate');
    });
  });

  describe('SQSClient configuration', () => {
    beforeEach(() => {
      process.env.EMAIL_QUEUE_URL =
        'https://sqs.us-east-1.amazonaws.com/123456789012/CatalogEmailQueue';
      process.env.AWS_REGION = 'us-east-1';
      mockSend.mockResolvedValue({ MessageId: 'test-id' });
    });

    test('should create SQSClient with correct region', async () => {
      await enqueueEmail('SignupConfirmation', 'user@example.com', {
        test: 'data',
      });

      expect(SQSClient).toHaveBeenCalledWith({
        region: 'us-east-1',
      });
    });
  });
});
