#!/bin/bash

# GitHub Actions AWS OIDC Setup Script
# This script helps set up AWS resources for GitHub Actions authentication

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
GITHUB_USERNAME=""
REPO_NAME=""
AWS_REGION="us-east-1"
ROLE_NAME="GitHubActionsRole"

echo -e "${GREEN}GitHub Actions AWS OIDC Setup${NC}"
echo "=================================="

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    exit 1
fi

# Check if user is logged in to AWS
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with AWS. Run 'aws configure' first${NC}"
    exit 1
fi

# Get GitHub repository information
if [ -z "$GITHUB_USERNAME" ]; then
    echo -n "Enter your GitHub username: "
    read GITHUB_USERNAME
fi

if [ -z "$REPO_NAME" ]; then
    echo -n "Enter your repository name: "
    read REPO_NAME
fi

echo -e "\n${YELLOW}Setting up for repository: ${GITHUB_USERNAME}/${REPO_NAME}${NC}"

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "AWS Account ID: ${AWS_ACCOUNT_ID}"

# Step 1: Create OIDC Identity Provider
echo -e "\n${YELLOW}Step 1: Creating OIDC Identity Provider...${NC}"

OIDC_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" &> /dev/null; then
    echo -e "${GREEN}✓ OIDC provider already exists${NC}"
else
    aws iam create-open-id-connect-provider \
        --url https://token.actions.githubusercontent.com \
        --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
        --client-id-list sts.amazonaws.com
    echo -e "${GREEN}✓ OIDC provider created${NC}"
fi

# Step 2: Create IAM Role
echo -e "\n${YELLOW}Step 2: Creating IAM Role...${NC}"

cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "${OIDC_ARN}"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_USERNAME}/${REPO_NAME}:*"
        }
      }
    }
  ]
}
EOF

if aws iam get-role --role-name "$ROLE_NAME" &> /dev/null; then
    echo -e "${GREEN}✓ IAM role already exists${NC}"
    aws iam update-assume-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-document file://trust-policy.json
    echo -e "${GREEN}✓ Trust policy updated${NC}"
else
    aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document file://trust-policy.json \
        --description "Role for GitHub Actions to deploy to AWS"
    echo -e "${GREEN}✓ IAM role created${NC}"
fi

# Step 3: Create and attach policies
echo -e "\n${YELLOW}Step 3: Creating and attaching policies...${NC}"

cat > github-actions-policy.json << EOF
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
        "ecs:RegisterTaskDefinition",
        "ecs:ListTasks",
        "ecs:DescribeClusters"
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
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:PassRole"
      ],
      "Resource": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole"
    }
  ]
}
EOF

POLICY_NAME="GitHubActionsPolicy"
POLICY_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:policy/${POLICY_NAME}"

if aws iam get-policy --policy-arn "$POLICY_ARN" &> /dev/null; then
    echo -e "${GREEN}✓ Policy already exists${NC}"
    # Update policy
    aws iam create-policy-version \
        --policy-arn "$POLICY_ARN" \
        --policy-document file://github-actions-policy.json \
        --set-as-default
    echo -e "${GREEN}✓ Policy updated${NC}"
else
    aws iam create-policy \
        --policy-name "$POLICY_NAME" \
        --policy-document file://github-actions-policy.json \
        --description "Policy for GitHub Actions deployment"
    echo -e "${GREEN}✓ Policy created${NC}"
fi

# Attach policy to role
aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn "$POLICY_ARN"
echo -e "${GREEN}✓ Policy attached to role${NC}"

# Step 4: Create ECR repositories
echo -e "\n${YELLOW}Step 4: Creating ECR repositories...${NC}"

for repo in "catalog-golf-backend" "catalog-golf-frontend"; do
    if aws ecr describe-repositories --repository-names "$repo" &> /dev/null; then
        echo -e "${GREEN}✓ ECR repository ${repo} already exists${NC}"
    else
        aws ecr create-repository --repository-name "$repo"
        echo -e "${GREEN}✓ ECR repository ${repo} created${NC}"
    fi
done

# Clean up temporary files
rm -f trust-policy.json github-actions-policy.json

# Output summary
echo -e "\n${GREEN}Setup Complete!${NC}"
echo "==================="
echo -e "Role ARN: ${GREEN}arn:aws:iam::${AWS_ACCOUNT_ID}:role/${ROLE_NAME}${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Go to your GitHub repository: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}"
echo "2. Navigate to Settings > Secrets and variables > Actions"
echo "3. Add these repository secrets:"
echo "   - AWS_ROLE_ARN: arn:aws:iam::${AWS_ACCOUNT_ID}:role/${ROLE_NAME}"
echo "   - PRODUCTION_DATABASE_URL: (your production database URL)"
echo "4. Push a commit to main or develop branch to test the CI/CD pipeline"
echo ""
echo -e "${YELLOW}ECR Repository URIs:${NC}"
echo "Backend: ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/catalog-golf-backend"
echo "Frontend: ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/catalog-golf-frontend" 