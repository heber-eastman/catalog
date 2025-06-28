# Email Integration To-Do List

A thorough checklist to track progress on wiring up real SES email integration.

## 1. SES Templates Terraform

- [ ]  Create `infra/email.tf` with AWS provider `us-east-1`.
- [ ]  Add `aws_ses_template` resource for `SignupConfirmation`.
- [ ]  Add `aws_ses_template` resource for `WelcomeEmail`.
- [ ]  Add `aws_ses_template` resource for `StaffInvitation`.
- [ ]  Add `aws_ses_template` resource for `SuperAdminInvitation`.
- [ ]  Run `terraform validate` and fix any issues.

## 2. SQS & DLQ Terraform

- [ ]  In `infra/email.tf`, add `aws_sqs_queue` “CatalogEmailQueue”:
    - visibility_timeout_seconds = 60
    - message_retention_seconds = 345600 (4 days)
- [ ]  Add `aws_sqs_queue` “CatalogEmailQueue-DLQ” with retention 345600.
- [ ]  Configure redrive policy on “CatalogEmailQueue” with DLQ and `maxReceiveCount = 5`.
- [ ]  Run `terraform validate` and `terraform plan` to verify changes.

## 3. Lambda & Event Mapping Terraform

- [ ]  Define `aws_iam_role` for Lambda with:
    - permissions for `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:GetQueueAttributes` on “CatalogEmailQueue”.
    - permission `ses:SendTemplatedEmail` on all templates.
- [ ]  Create `aws_lambda_function` “SendEmailWorker”:
    - Node.js 18.x runtime, handler `index.handler`, environment vars `SES_REGION` and `SES_FROM`.
    - Zip artifact at `lambda/sendEmailWorker.zip`.
- [ ]  Add `aws_lambda_event_source_mapping` linking “CatalogEmailQueue” to “SendEmailWorker”.
- [ ]  Run `terraform apply` and confirm resources.

## 4. Lambda Handler & Unit Tests

- [ ]  Scaffold `lambda/sendEmailWorker/` folder.
- [ ]  Initialize `package.json` with `@aws-sdk/client-ses` and `aws-lambda`.
- [ ]  Create `index.js` exporting `handler(event)` that:
    - Parses SQS records.
    - Calls SES `SendTemplatedEmailCommand` with payload.
    - Throws on failure to trigger retry.
- [ ]  Write Jest tests in `index.test.js`:
    - Mock `SESClient.send()` to succeed.
    - Mock `SESClient.send()` to throw.
- [ ]  Implement handler until tests pass.

## 5. enqueueEmail Utility & Unit Tests

- [ ]  Create `backend/src/emailQueue.js`.
- [ ]  Install `@aws-sdk/client-sqs`.
- [ ]  Implement `enqueueEmail(templateName, toAddress, templateData)`:
    - Sends `SendMessageCommand` to `process.env.EMAIL_QUEUE_URL`.
- [ ]  Write Jest tests:
    - Mock `SQSClient.send()` and assert `QueueUrl` and `MessageBody`.
- [ ]  Ensure tests pass and utility is exported.

## 6. Signup Controller Integration & supertest

- [ ]  In `backend/src/controllers/signup.js`, import `enqueueEmail`.
- [ ]  After creating course and StaffUser, call:
    
    ```jsx
    await enqueueEmail(
      "SignupConfirmation",  operatorEmail,  { confirmation_link, course_name }
    );
    ```
    
- [ ]  Write supertest in `signup.test.js`:
    - Mock SQS to capture messages.
    - POST to `/api/v1/signup`.
    - Assert one message enqueued with correct payload.
- [ ]  Implement until test passes.

## 7. Confirmation → Welcome Email Integration

- [ ]  In `backend/src/controllers/confirm.js`, import `enqueueEmail`.
- [ ]  After activating user and course, add:
    
    ```jsx
    await enqueueEmail(
      "WelcomeEmail",  userEmail,  { user_name, course_name }
    );
    ```
    
- [ ]  Write supertest for `/api/v1/confirm?token=...`:
    - Mock SQS.
    - Assert a WelcomeEmail job is queued.
- [ ]  Implement until test passes.

## 8. Staff Invitation Email Integration

- [ ]  In `backend/src/controllers/staffInvite.js`, import `enqueueEmail`.
- [ ]  After creating StaffUser invitation, add:
    
    ```jsx
    await enqueueEmail(
      "StaffInvitation",  inviteEmail,  { invitation_link, course_name }
    );
    ```
    
- [ ]  Write supertest for `/api/v1/staff/invite`:
    - Mock SQS.
    - Assert a StaffInvitation job is queued.
- [ ]  Implement until tests pass.

## 9. Super-Admin Invitation Integration

- [ ]  In `backend/src/controllers/superAdminInvite.js`, import `enqueueEmail`.
- [ ]  After creating SuperAdminUser invitation, add:
    
    ```jsx
    await enqueueEmail(
      "SuperAdminInvitation",  inviteEmail,  { invitation_link }
    );
    ```
    
- [ ]  Write supertest for `/api/v1/super-admins/invite`:
    - Mock SQS.
    - Assert a SuperAdminInvitation job is queued.
- [ ]  Implement until tests pass.

## 10. Localstack End-to-End Integration Test

- [ ]  Configure Jest integration tests with Localstack for SES and SQS.
- [ ]  Write a test that:
    - Calls `/api/v1/signup`.
    - Polls the Localstack SQS queue for a message.
    - Invokes the Lambda `handler()` with that message.
    - Asserts that Localstack SES received a `SendTemplatedEmailCommand`.
- [ ]  Verify full flow succeeds locally and in CI.
