#!/bin/bash

# Backend Production Fix Deployment Script
# This script deploys the corrected backend that properly handles NODE_ENV

set -e

echo "🚨 DEPLOYING CRITICAL PRODUCTION FIX"
echo "===================================="
echo "Fix: NODE_ENV now properly set to 'production' in production environment"
echo "Fix: Rate limiting re-enabled for production security"
echo ""

# Configuration
REGION="us-east-1"
ECR_REPOSITORY="catalog-golf-backend"
ECS_CLUSTER="catalog-golf-cluster"
ECS_SERVICE="catalog-golf-backend"
TASK_DEFINITION_FAMILY="catalog-golf-backend"

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPOSITORY"

echo "📋 Configuration:"
echo "   Region: $REGION"
echo "   ECR Repository: $ECR_REPOSITORY"
echo "   ECS Cluster: $ECS_CLUSTER"
echo "   ECS Service: $ECS_SERVICE"
echo "   ECR URI: $ECR_URI"
echo ""

echo "🏗️  Building Docker image..."
cd backend
docker build -t $ECR_REPOSITORY:latest .
cd ..

echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_URI

echo "🏷️  Tagging image..."
docker tag $ECR_REPOSITORY:latest $ECR_URI:latest
docker tag $ECR_REPOSITORY:latest $ECR_URI:$(date +%Y%m%d-%H%M%S)

echo "📤 Pushing image to ECR..."
docker push $ECR_URI:latest
docker push $ECR_URI:$(date +%Y%m%d-%H%M%S)

echo "📋 Getting current task definition..."
CURRENT_TASK_DEF=$(aws ecs describe-task-definition --task-definition $TASK_DEFINITION_FAMILY --region $REGION)

echo "✏️  Creating new task definition..."
NEW_TASK_DEF=$(echo $CURRENT_TASK_DEF | jq --arg IMAGE "$ECR_URI:latest" '.taskDefinition | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy) | .containerDefinitions[0].image = $IMAGE')

echo "📝 Registering new task definition..."
NEW_TASK_DEF_ARN=$(echo $NEW_TASK_DEF | aws ecs register-task-definition --region $REGION --cli-input-json file:///dev/stdin | jq -r '.taskDefinition.taskDefinitionArn')

echo "🔄 Updating ECS service..."
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $ECS_SERVICE \
    --task-definition $NEW_TASK_DEF_ARN \
    --region $REGION | cat

echo ""
echo "✅ CRITICAL PRODUCTION FIX DEPLOYED!"
echo "===================================="
echo "✅ NODE_ENV will now properly be 'production' in production"
echo "✅ Rate limiting is re-enabled for security"
echo "✅ .env files won't override production environment variables"
echo ""
echo "🔍 Monitor the deployment:"
echo "   aws ecs describe-services --cluster $ECS_CLUSTER --services $ECS_SERVICE --region $REGION"
echo ""
echo "🧪 Test the fix with:"
echo "   curl https://api.catalog.golf/health"
echo "   # Should show NODE_ENV: production in logs"
echo "===================="
echo "- Docker Image: $ECR_URI:latest"
echo "- ECS Cluster: $ECS_CLUSTER"
echo "- ECS Service: $ECS_SERVICE"
echo "- Deployment Status: ✅ Complete"
echo ""
echo "🔗 To monitor logs:"
echo "aws logs tail /ecs/catalog-golf-backend --follow --region $REGION"
echo ""
echo "🔗 To verify NODE_ENV in logs:"
echo "aws logs filter-log-events --log-group-name /ecs/catalog-golf-backend --filter-pattern 'NODE_ENV: production' --region $REGION" 