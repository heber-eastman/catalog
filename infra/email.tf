provider "aws" {
  region = "us-east-1"
}

# SES Template for Signup Confirmation
resource "aws_ses_template" "signup_confirmation" {
  name = "SignupConfirmation"

  subject = "Confirm Your Golf Course Registration - {{course_name}}"

  html = <<EOF
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Confirm Your Registration</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2c5530; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9f9f9; }
        .button { display: inline-block; background: #2c5530; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to Catalog Golf</h1>
        </div>
        <div class="content">
            <h2>Confirm Your Registration for {{course_name}}</h2>
            <p>Thank you for registering your golf course with Catalog Golf! To complete your registration and activate your account, please click the confirmation link below:</p>
            
            <a href="{{confirmation_link}}" class="button">Confirm Registration</a>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="{{confirmation_link}}">{{confirmation_link}}</a></p>
            
            <p>This confirmation link will expire in 24 hours for security purposes.</p>
            
            <p>If you didn't request this registration, please ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; 2025 Catalog Golf. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
EOF

  text = <<EOF
Welcome to Catalog Golf!

Confirm Your Registration for {{course_name}}

Thank you for registering your golf course with Catalog Golf! To complete your registration and activate your account, please visit the following link:

{{confirmation_link}}

This confirmation link will expire in 24 hours for security purposes.

If you didn't request this registration, please ignore this email.

---
© 2025 Catalog Golf. All rights reserved.
EOF
}

# SES Template for Welcome Email
resource "aws_ses_template" "welcome_email" {
  name = "WelcomeEmail"

  subject = "Welcome to Catalog Golf - Your {{course_name}} Account is Active!"

  html = <<EOF
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Welcome to Catalog Golf</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2c5530; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9f9f9; }
        .button { display: inline-block; background: #2c5530; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        .feature { margin: 15px 0; padding: 15px; background: white; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Welcome to Catalog Golf!</h1>
        </div>
        <div class="content">
            <h2>Hello {{user_name}}!</h2>
            <p>Congratulations! Your {{course_name}} account is now active and ready to use.</p>
            
            <div class="feature">
                <h3>✅ What's Next?</h3>
                <ul>
                    <li>Log in to your dashboard to start managing customers</li>
                    <li>Add staff members to help manage your golf course</li>
                    <li>Customize your course settings and preferences</li>
                    <li>Start tracking customer information and notes</li>
                </ul>
            </div>
            
            <a href="https://app.catalog.golf/login" class="button">Access Your Dashboard</a>
            
            <p>If you have any questions or need assistance getting started, don't hesitate to reach out to our support team.</p>
            
            <p>Thank you for choosing Catalog Golf to manage your golf course operations!</p>
        </div>
        <div class="footer">
            <p>&copy; 2025 Catalog Golf. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
EOF

  text = <<EOF
🎉 Welcome to Catalog Golf!

Hello {{user_name}}!

Congratulations! Your {{course_name}} account is now active and ready to use.

What's Next?
- Log in to your dashboard to start managing customers
- Add staff members to help manage your golf course  
- Customize your course settings and preferences
- Start tracking customer information and notes

Access your dashboard: https://app.catalog.golf/login

If you have any questions or need assistance getting started, don't hesitate to reach out to our support team.

Thank you for choosing Catalog Golf to manage your golf course operations!

---
© 2025 Catalog Golf. All rights reserved.
EOF
}

# SES Template for Staff Invitation
resource "aws_ses_template" "staff_invitation" {
  name = "StaffInvitation"

  subject = "You're Invited to Join {{course_name}} on Catalog Golf"

  html = <<EOF
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Staff Invitation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2c5530; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9f9f9; }
        .button { display: inline-block; background: #2c5530; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        .highlight { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Staff Invitation</h1>
        </div>
        <div class="content">
            <h2>You're Invited to Join {{course_name}}</h2>
            <p>You've been invited to join the staff team at {{course_name}} on Catalog Golf, our customer management platform.</p>
            
            <div class="highlight">
                <h3>🏌️ As a staff member, you'll be able to:</h3>
                <ul>
                    <li>View and manage customer information</li>
                    <li>Add notes and track customer interactions</li>
                    <li>Access course management tools</li>
                    <li>Collaborate with other staff members</li>
                </ul>
            </div>
            
            <p>To accept this invitation and set up your account, click the link below:</p>
            
            <a href="{{invitation_link}}" class="button">Accept Invitation</a>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="{{invitation_link}}">{{invitation_link}}</a></p>
            
            <p>This invitation link will expire in 7 days for security purposes.</p>
            
            <p>If you weren't expecting this invitation, please ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; 2025 Catalog Golf. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
EOF

  text = <<EOF
Staff Invitation - {{course_name}}

You're Invited to Join {{course_name}}

You've been invited to join the staff team at {{course_name}} on Catalog Golf, our customer management platform.

As a staff member, you'll be able to:
- View and manage customer information
- Add notes and track customer interactions  
- Access course management tools
- Collaborate with other staff members

To accept this invitation and set up your account, visit:
{{invitation_link}}

This invitation link will expire in 7 days for security purposes.

If you weren't expecting this invitation, please ignore this email.

---
© 2025 Catalog Golf. All rights reserved.
EOF
}

# SES Template for Super Admin Invitation
resource "aws_ses_template" "super_admin_invitation" {
  name = "SuperAdminInvitation"

  subject = "Super Admin Invitation - Catalog Golf Platform"

  html = <<EOF
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Super Admin Invitation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1a4d1e; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9f9f9; }
        .button { display: inline-block; background: #1a4d1e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        .admin-badge { background: #1a4d1e; color: white; padding: 15px; border-radius: 5px; margin: 15px 0; text-align: center; }
        .permissions { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Super Admin Invitation</h1>
        </div>
        <div class="content">
            <div class="admin-badge">
                <h2>You've been invited as a Super Administrator</h2>
            </div>
            
            <p>You've been granted super administrator access to the Catalog Golf platform. This is the highest level of access with full system privileges.</p>
            
            <div class="permissions">
                <h3>🛡️ Super Admin Capabilities:</h3>
                <ul>
                    <li>Manage all golf courses across the platform</li>
                    <li>Create and manage other super administrators</li>
                    <li>Access system-wide analytics and reports</li>
                    <li>Configure platform settings and features</li>
                    <li>Monitor system health and performance</li>
                    <li>Handle escalated support issues</li>
                </ul>
            </div>
            
            <p>To accept this invitation and set up your super admin account, click the link below:</p>
            
            <a href="{{invitation_link}}" class="button">Accept Super Admin Invitation</a>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="{{invitation_link}}">{{invitation_link}}</a></p>
            
            <p><strong>Important:</strong> This invitation link will expire in 7 days for security purposes.</p>
            
            <p>If you weren't expecting this invitation or have concerns about this access level, please contact the platform administrator immediately.</p>
        </div>
        <div class="footer">
            <p>&copy; 2025 Catalog Golf. All rights reserved.</p>
            <p><em>This is a privileged access invitation - handle with care</em></p>
        </div>
    </div>
</body>
</html>
EOF

  text = <<EOF
🔐 Super Admin Invitation - Catalog Golf Platform

You've been invited as a Super Administrator

You've been granted super administrator access to the Catalog Golf platform. This is the highest level of access with full system privileges.

Super Admin Capabilities:
- Manage all golf courses across the platform
- Create and manage other super administrators
- Access system-wide analytics and reports
- Configure platform settings and features
- Monitor system health and performance
- Handle escalated support issues

To accept this invitation and set up your super admin account, visit:
{{invitation_link}}

IMPORTANT: This invitation link will expire in 7 days for security purposes.

If you weren't expecting this invitation or have concerns about this access level, please contact the platform administrator immediately.

---
© 2025 Catalog Golf. All rights reserved.
This is a privileged access invitation - handle with care
EOF
}

# SQS Dead Letter Queue for failed email processing
resource "aws_sqs_queue" "catalog_email_dlq" {
  name                      = "CatalogEmailQueue-DLQ"
  message_retention_seconds = 345600  # 4 days
  
  tags = {
    Name        = "Catalog Email DLQ"
    Environment = "production"
    Purpose     = "Dead letter queue for failed email processing"
  }
}

# SQS Queue for email processing
resource "aws_sqs_queue" "catalog_email_queue" {
  name                      = "CatalogEmailQueue"
  visibility_timeout_seconds = 60
  message_retention_seconds = 345600  # 4 days
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.catalog_email_dlq.arn
    maxReceiveCount     = 5
  })
  
  tags = {
    Name        = "Catalog Email Queue"
    Environment = "production"
    Purpose     = "Queue for processing email jobs"
  }
}

# IAM role for Lambda function
resource "aws_iam_role" "send_email_worker_role" {
  name = "SendEmailWorkerRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "Send Email Worker Role"
    Environment = "production"
    Purpose     = "IAM role for email processing Lambda"
  }
}

# IAM policy for Lambda to access SQS and SES
resource "aws_iam_policy" "send_email_worker_policy" {
  name        = "SendEmailWorkerPolicy"
  description = "Policy for Lambda to process email queue and send emails via SES"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.catalog_email_queue.arn
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendTemplatedEmail"
        ]
        Resource = [
          aws_ses_template.signup_confirmation.arn,
          aws_ses_template.welcome_email.arn,
          aws_ses_template.staff_invitation.arn,
          aws_ses_template.super_admin_invitation.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:us-east-1:*:*"
      }
    ]
  })

  tags = {
    Name        = "Send Email Worker Policy"
    Environment = "production"
    Purpose     = "Permissions for email processing Lambda"
  }
}

# Attach policy to role
resource "aws_iam_role_policy_attachment" "send_email_worker_policy_attachment" {
  role       = aws_iam_role.send_email_worker_role.name
  policy_arn = aws_iam_policy.send_email_worker_policy.arn
}

# Lambda function for processing email queue
resource "aws_lambda_function" "send_email_worker" {
  filename         = "lambda/sendEmailWorker.zip"
  function_name    = "SendEmailWorker"
  role            = aws_iam_role.send_email_worker_role.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 30

  environment {
    variables = {
      SES_REGION = "us-east-1"
      SES_FROM   = "noreply@catalog.golf"
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.send_email_worker_policy_attachment,
  ]

  tags = {
    Name        = "Send Email Worker"
    Environment = "production"
    Purpose     = "Processes email jobs from SQS and sends via SES"
  }
}

# Event source mapping to trigger Lambda from SQS
resource "aws_lambda_event_source_mapping" "catalog_email_queue_mapping" {
  event_source_arn = aws_sqs_queue.catalog_email_queue.arn
  function_name    = aws_lambda_function.send_email_worker.arn
  batch_size       = 10
  
  depends_on = [
    aws_iam_role_policy_attachment.send_email_worker_policy_attachment,
  ]
} 