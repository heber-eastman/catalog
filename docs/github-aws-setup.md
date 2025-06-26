# GitHub Actions AWS OIDC Setup

This document explains how to set up secure AWS authentication for GitHub Actions using OpenID Connect (OIDC) instead of storing long-lived access keys.

## Overview

The CI/CD pipeline uses AWS OIDC to authenticate with AWS services. This is more secure than storing AWS access keys as GitHub secrets because:

- No long-lived credentials stored in GitHub
- Credentials are automatically rotated
- Fine-grained permissions per repository
- Audit trail of authentication events

## Setup Steps

### 1. Create AWS OIDC Identity Provider

In your AWS account, create an OIDC identity provider:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --client-id-list sts.amazonaws.com
```

### 2. Create IAM Role for GitHub Actions

Create an IAM role that GitHub Actions can assume:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/YOUR_REPO_NAME:*"
        }
      }
    }
  ]
}
```

### 3. Attach Policies to the Role

The role needs permissions for:

- ECR (Elastic Container Registry)
- ECS (Elastic Container Service)
- CloudWatch Logs (for deployment monitoring)

Example managed policies to attach:
- `AmazonEC2ContainerRegistryPowerUser`
- `AmazonECS_FullAccess`
- `CloudWatchLogsFullAccess`

Or create a custom policy with minimal permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecs:UpdateService",
        "ecs:DescribeServices",
        "ecs:DescribeTasks",
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ],
      "Resource": "*"
    }
  ]
}
```

### 4. Configure GitHub Repository Secrets

In your GitHub repository, go to Settings > Secrets and variables > Actions, and add:

1. **AWS_ROLE_ARN**: The ARN of the IAM role created above
   ```
   arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActionsRole
   ```

2. **PRODUCTION_DATABASE_URL**: Database URL for production deployments
   ```
   postgres://username:password@hostname:5432/database_name
   ```

### 5. Verify ECR Repositories Exist

Make sure the following ECR repositories exist in your AWS account:
- `catalog-golf-backend`
- `catalog-golf-frontend`

Create them if they don't exist:

```bash
aws ecr create-repository --repository-name catalog-golf-backend
aws ecr create-repository --repository-name catalog-golf-frontend
```

### 6. Verify ECS Resources

Ensure the following ECS resources exist:
- Cluster: `catalog-golf`
- Services: `catalog-golf-backend`, `catalog-golf-frontend`
- For staging: `catalog-golf-staging` cluster with `catalog-golf-backend-staging` and `catalog-golf-frontend-staging` services

## Testing the Setup

1. Push a commit to the `main` or `develop` branch
2. Check the GitHub Actions tab to see if the `build-docker` job runs successfully
3. Verify that the AWS authentication step passes

## Troubleshooting

### "Credentials could not be loaded" Error

This usually means:
1. The OIDC provider is not set up correctly
2. The IAM role trust policy is incorrect
3. The `AWS_ROLE_ARN` secret is not set or incorrect

### "Access Denied" Errors

This means the IAM role doesn't have sufficient permissions. Check that:
1. The role has the necessary policies attached
2. The ECR repositories exist
3. The ECS resources exist and are in the correct region

### Repository Condition Not Matching

Make sure the trust policy condition matches your exact repository:
```
"token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/YOUR_REPO_NAME:*"
```

## Security Best Practices

1. Use the most restrictive IAM policies possible
2. Regularly rotate the OIDC thumbprint if needed
3. Monitor CloudTrail logs for authentication events
4. Use separate roles for different environments (staging vs production)
5. Consider using environment-specific secrets for sensitive data

## Alternative: Access Keys (Less Secure)

If OIDC setup is not possible, you can use traditional access keys:

1. Create an IAM user with programmatic access
2. Attach the necessary policies to the user
3. Add these secrets to GitHub:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

However, OIDC is strongly recommended for better security. 