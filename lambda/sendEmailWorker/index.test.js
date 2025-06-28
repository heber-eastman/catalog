const { handler } = require('./index');
const { SESClient, SendTemplatedEmailCommand } = require('@aws-sdk/client-ses');

// Mock the AWS SDK
jest.mock('@aws-sdk/client-ses');

describe('SendEmailWorker Lambda Handler', () => {
  let mockSend;
  let mockSESClient;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Create mock send method
    mockSend = jest.fn();

    // Mock SESClient constructor and instance
    mockSESClient = {
      send: mockSend,
    };
    SESClient.mockImplementation(() => mockSESClient);
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.SES_REGION;
    delete process.env.SES_FROM;
  });

  describe('Successful email sending', () => {
    beforeEach(() => {
      // Set up environment variables
      process.env.SES_REGION = 'us-east-1';
      process.env.SES_FROM = 'noreply@catalog.golf';

      // Mock successful SES response
      mockSend.mockResolvedValue({
        MessageId: 'test-message-id-123',
      });
    });

    test('should process single SQS record successfully', async () => {
      const event = {
        Records: [
          {
            body: JSON.stringify({
              templateName: 'SignupConfirmation',
              toAddress: 'user@example.com',
              templateData: {
                course_name: 'Pine Valley Golf Club',
                confirmation_link:
                  'https://app.catalog.golf/confirm?token=abc123',
              },
            }),
          },
        ],
      };

      await expect(handler(event)).resolves.toBeUndefined();

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.any(SendTemplatedEmailCommand)
      );

      // Verify the command was created with correct parameters
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(SendTemplatedEmailCommand);

      // Check that the command was constructed with the right parameters
      // We can verify this by checking the constructor call
      expect(SendTemplatedEmailCommand).toHaveBeenCalledWith({
        Source: 'noreply@catalog.golf',
        Destination: {
          ToAddresses: ['user@example.com'],
        },
        Template: 'SignupConfirmation',
        TemplateData: JSON.stringify({
          course_name: 'Pine Valley Golf Club',
          confirmation_link: 'https://app.catalog.golf/confirm?token=abc123',
        }),
      });
    });

    test('should process multiple SQS records successfully', async () => {
      const event = {
        Records: [
          {
            body: JSON.stringify({
              templateName: 'SignupConfirmation',
              toAddress: 'user1@example.com',
              templateData: { course_name: 'Golf Club 1' },
            }),
          },
          {
            body: JSON.stringify({
              templateName: 'WelcomeEmail',
              toAddress: 'user2@example.com',
              templateData: { user_name: 'John', course_name: 'Golf Club 2' },
            }),
          },
        ],
      };

      await expect(handler(event)).resolves.toBeUndefined();

      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    test('should handle different template types', async () => {
      const templates = [
        'SignupConfirmation',
        'WelcomeEmail',
        'StaffInvitation',
        'SuperAdminInvitation',
      ];

      for (const templateName of templates) {
        const event = {
          Records: [
            {
              body: JSON.stringify({
                templateName,
                toAddress: 'test@example.com',
                templateData: { test: 'data' },
              }),
            },
          ],
        };

        await expect(handler(event)).resolves.toBeUndefined();
      }

      expect(mockSend).toHaveBeenCalledTimes(templates.length);
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      process.env.SES_REGION = 'us-east-1';
      process.env.SES_FROM = 'noreply@catalog.golf';
    });

    test('should throw error when SES send fails', async () => {
      const sesError = new Error('SES service unavailable');
      mockSend.mockRejectedValue(sesError);

      const event = {
        Records: [
          {
            body: JSON.stringify({
              templateName: 'SignupConfirmation',
              toAddress: 'user@example.com',
              templateData: { course_name: 'Test Golf Club' },
            }),
          },
        ],
      };

      await expect(handler(event)).rejects.toThrow('SES service unavailable');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test('should throw error when record body is invalid JSON', async () => {
      const event = {
        Records: [
          {
            body: 'invalid-json',
          },
        ],
      };

      await expect(handler(event)).rejects.toThrow();
      expect(mockSend).not.toHaveBeenCalled();
    });

    test('should throw error when required fields are missing', async () => {
      const event = {
        Records: [
          {
            body: JSON.stringify({
              // Missing templateName
              toAddress: 'user@example.com',
              templateData: { test: 'data' },
            }),
          },
        ],
      };

      await expect(handler(event)).rejects.toThrow();
      expect(mockSend).not.toHaveBeenCalled();
    });

    test('should throw error when environment variables are missing', async () => {
      // Don't set environment variables
      const event = {
        Records: [
          {
            body: JSON.stringify({
              templateName: 'SignupConfirmation',
              toAddress: 'user@example.com',
              templateData: { test: 'data' },
            }),
          },
        ],
      };

      await expect(handler(event)).rejects.toThrow();
    });
  });

  describe('Input validation', () => {
    beforeEach(() => {
      process.env.SES_REGION = 'us-east-1';
      process.env.SES_FROM = 'noreply@catalog.golf';
      mockSend.mockResolvedValue({ MessageId: 'test-id' });
    });

    test('should validate email address format', async () => {
      const event = {
        Records: [
          {
            body: JSON.stringify({
              templateName: 'SignupConfirmation',
              toAddress: 'invalid-email',
              templateData: { test: 'data' },
            }),
          },
        ],
      };

      await expect(handler(event)).rejects.toThrow();
      expect(mockSend).not.toHaveBeenCalled();
    });

    test('should validate template name', async () => {
      const event = {
        Records: [
          {
            body: JSON.stringify({
              templateName: 'InvalidTemplate',
              toAddress: 'user@example.com',
              templateData: { test: 'data' },
            }),
          },
        ],
      };

      await expect(handler(event)).rejects.toThrow();
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
