#!/bin/bash

# ECS Infrastructure Setup Script
# This script creates all the necessary ECS resources for the Catalog Golf application

set -e

# Configuration
CLUSTER_NAME="catalog-golf-cluster"
VPC_NAME="catalog-golf-vpc"
BACKEND_SERVICE="catalog-golf-backend"
FRONTEND_SERVICE="catalog-golf-frontend"
BACKEND_ECR_REPO="catalog-golf-backend"
FRONTEND_ECR_REPO="catalog-golf-frontend"
AWS_REGION="us-east-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "🚀 Setting up ECS infrastructure for Catalog Golf application..."
echo "Account ID: $ACCOUNT_ID"
echo "Region: $AWS_REGION"

# Disable AWS pager
export AWS_PAGER=""

# 1. Get VPC information (use the first one if multiple exist)
echo "📡 Finding VPC information..."
VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=tag:Name,Values=$VPC_NAME" \
  --query 'Vpcs[0].VpcId' \
  --output text)

if [ "$VPC_ID" = "None" ] || [ -z "$VPC_ID" ]; then
  echo "❌ VPC $VPC_NAME not found. Please run the AWS setup script first."
  exit 1
fi

echo "✅ Found VPC: $VPC_ID"

# Get subnets
SUBNET_IDS_SPACE=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[*].SubnetId' \
  --output text)

SUBNET_IDS_COMMA=$(echo $SUBNET_IDS_SPACE | tr ' ' ',')

echo "✅ Found subnets: $SUBNET_IDS_SPACE"

# Get security group
SECURITY_GROUP_ID=$(aws ec2 describe-security-groups \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=catalog-golf-sg" \
  --query 'SecurityGroups[0].GroupId' \
  --output text)

if [ "$SECURITY_GROUP_ID" = "None" ] || [ -z "$SECURITY_GROUP_ID" ]; then
  echo "❌ Security group catalog-golf-sg not found. Creating it..."
  
  SECURITY_GROUP_ID=$(aws ec2 create-security-group \
    --group-name catalog-golf-sg \
    --description "Security group for Catalog Golf ECS services" \
    --vpc-id $VPC_ID \
    --query 'GroupId' \
    --output text)
  
  # Add inbound rules
  aws ec2 authorize-security-group-ingress \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0
  
  aws ec2 authorize-security-group-ingress \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0
  
  aws ec2 authorize-security-group-ingress \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 3000 \
    --cidr 0.0.0.0/0
  
  aws ec2 authorize-security-group-ingress \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 8080 \
    --cidr 0.0.0.0/0
  
  echo "✅ Created security group: $SECURITY_GROUP_ID"
else
  echo "✅ Found security group: $SECURITY_GROUP_ID"
fi

# 2. Create ECS Cluster
echo "🏗️  Creating ECS cluster..."
if aws ecs describe-clusters --clusters $CLUSTER_NAME --query 'clusters[0].clusterName' --output text 2>/dev/null | grep -q $CLUSTER_NAME; then
  echo "✅ ECS cluster $CLUSTER_NAME already exists"
else
  aws ecs create-cluster --cluster-name $CLUSTER_NAME
  echo "✅ Created ECS cluster: $CLUSTER_NAME"
  
  # Add capacity provider after cluster creation
  aws ecs put-cluster-capacity-providers \
    --cluster $CLUSTER_NAME \
    --capacity-providers FARGATE \
    --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1
  echo "✅ Added FARGATE capacity provider to cluster"
fi

# 3. Create IAM role for ECS tasks
echo "👤 Creating ECS task execution role..."
TASK_ROLE_NAME="ecsTaskExecutionRole-catalog-golf"

if aws iam get-role --role-name $TASK_ROLE_NAME >/dev/null 2>&1; then
  echo "✅ Task execution role already exists"
else
  # Create trust policy
  cat > /tmp/ecs-task-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

  aws iam create-role \
    --role-name $TASK_ROLE_NAME \
    --assume-role-policy-document file:///tmp/ecs-task-trust-policy.json

  aws iam attach-role-policy \
    --role-name $TASK_ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

  # Add SSM permissions for secrets
  aws iam attach-role-policy \
    --role-name $TASK_ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess

  echo "✅ Created task execution role: $TASK_ROLE_NAME"
fi

TASK_ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/$TASK_ROLE_NAME"

# 4. Create Application Load Balancer
echo "⚖️  Creating Application Load Balancer..."
ALB_NAME="catalog-golf-alb"

ALB_ARN=$(aws elbv2 describe-load-balancers \
  --names $ALB_NAME \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text 2>/dev/null || echo "None")

if [ "$ALB_ARN" = "None" ]; then
  ALB_ARN=$(aws elbv2 create-load-balancer \
    --name $ALB_NAME \
    --subnets $SUBNET_IDS_SPACE \
    --security-groups $SECURITY_GROUP_ID \
    --scheme internet-facing \
    --type application \
    --ip-address-type ipv4 \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text)
  
  echo "✅ Created ALB: $ALB_ARN"
else
  echo "✅ ALB already exists: $ALB_ARN"
fi

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

echo "✅ ALB DNS: $ALB_DNS"

# 5. Create Target Groups
echo "🎯 Creating target groups..."

# Backend target group
BACKEND_TG_ARN=$(aws elbv2 describe-target-groups \
  --names "catalog-golf-backend-tg" \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text 2>/dev/null || echo "None")

if [ "$BACKEND_TG_ARN" = "None" ]; then
  BACKEND_TG_ARN=$(aws elbv2 create-target-group \
    --name catalog-golf-backend-tg \
    --protocol HTTP \
    --port 3000 \
    --vpc-id $VPC_ID \
    --target-type ip \
    --health-check-path /health \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)
  
  echo "✅ Created backend target group: $BACKEND_TG_ARN"
else
  echo "✅ Backend target group already exists: $BACKEND_TG_ARN"
fi

# Frontend target group
FRONTEND_TG_ARN=$(aws elbv2 describe-target-groups \
  --names "catalog-golf-frontend-tg" \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text 2>/dev/null || echo "None")

if [ "$FRONTEND_TG_ARN" = "None" ]; then
  FRONTEND_TG_ARN=$(aws elbv2 create-target-group \
    --name catalog-golf-frontend-tg \
    --protocol HTTP \
    --port 80 \
    --vpc-id $VPC_ID \
    --target-type ip \
    --health-check-path / \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)
  
  echo "✅ Created frontend target group: $FRONTEND_TG_ARN"
else
  echo "✅ Frontend target group already exists: $FRONTEND_TG_ARN"
fi

# 6. Create ALB Listeners
echo "👂 Creating ALB listeners..."

# HTTP listener
HTTP_LISTENER_ARN=$(aws elbv2 describe-listeners \
  --load-balancer-arn $ALB_ARN \
  --query 'Listeners[?Port==`80`].ListenerArn' \
  --output text)

if [ -z "$HTTP_LISTENER_ARN" ]; then
  HTTP_LISTENER_ARN=$(aws elbv2 create-listener \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn=$FRONTEND_TG_ARN \
    --query 'Listeners[0].ListenerArn' \
    --output text)
  
  echo "✅ Created HTTP listener: $HTTP_LISTENER_ARN"
else
  echo "✅ HTTP listener already exists: $HTTP_LISTENER_ARN"
fi

# Create listener rules for backend API
aws elbv2 create-rule \
  --listener-arn $HTTP_LISTENER_ARN \
  --priority 100 \
  --conditions Field=path-pattern,Values="/api/*" \
  --actions Type=forward,TargetGroupArn=$BACKEND_TG_ARN \
  2>/dev/null || echo "✅ Backend API rule already exists"

aws elbv2 create-rule \
  --listener-arn $HTTP_LISTENER_ARN \
  --priority 101 \
  --conditions Field=path-pattern,Values="/health" \
  --actions Type=forward,TargetGroupArn=$BACKEND_TG_ARN \
  2>/dev/null || echo "✅ Backend health rule already exists"

# 7. Create Task Definitions
echo "📋 Creating task definitions..."

# Backend task definition
cat > /tmp/backend-task-definition.json << EOF
{
  "family": "$BACKEND_SERVICE",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "$TASK_ROLE_ARN",
  "taskRoleArn": "$TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "$BACKEND_SERVICE",
      "image": "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$BACKEND_ECR_REPO:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:ssm:$AWS_REGION:$ACCOUNT_ID:parameter/catalog-golf/database-url"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:ssm:$AWS_REGION:$ACCOUNT_ID:parameter/catalog-golf/jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/$BACKEND_SERVICE",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

# Frontend task definition
cat > /tmp/frontend-task-definition.json << EOF
{
  "family": "$FRONTEND_SERVICE",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "$TASK_ROLE_ARN",
  "taskRoleArn": "$TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "$FRONTEND_SERVICE",
      "image": "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$FRONTEND_ECR_REPO:latest",
      "portMappings": [
        {
          "containerPort": 80,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {
          "name": "VITE_API_BASE_URL",
          "value": "http://$ALB_DNS/api/v1"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/$FRONTEND_SERVICE",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

# Create CloudWatch log groups
aws logs create-log-group --log-group-name "/ecs/$BACKEND_SERVICE" 2>/dev/null || echo "✅ Backend log group already exists"
aws logs create-log-group --log-group-name "/ecs/$FRONTEND_SERVICE" 2>/dev/null || echo "✅ Frontend log group already exists"

# Register task definitions
echo "📝 Registering task definitions..."
aws ecs register-task-definition --cli-input-json file:///tmp/backend-task-definition.json
aws ecs register-task-definition --cli-input-json file:///tmp/frontend-task-definition.json

echo "✅ Task definitions registered"

# 8. Create ECS Services
echo "🚀 Creating ECS services..."

# Backend service
if aws ecs describe-services --cluster $CLUSTER_NAME --services $BACKEND_SERVICE --query 'services[0].serviceName' --output text 2>/dev/null | grep -q $BACKEND_SERVICE; then
  echo "✅ Backend service already exists"
else
  aws ecs create-service \
    --cluster $CLUSTER_NAME \
    --service-name $BACKEND_SERVICE \
    --task-definition $BACKEND_SERVICE \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS_COMMA],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=$BACKEND_TG_ARN,containerName=$BACKEND_SERVICE,containerPort=3000"
  
  echo "✅ Created backend service"
fi

# Frontend service
if aws ecs describe-services --cluster $CLUSTER_NAME --services $FRONTEND_SERVICE --query 'services[0].serviceName' --output text 2>/dev/null | grep -q $FRONTEND_SERVICE; then
  echo "✅ Frontend service already exists"
else
  aws ecs create-service \
    --cluster $CLUSTER_NAME \
    --service-name $FRONTEND_SERVICE \
    --task-definition $FRONTEND_SERVICE \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS_COMMA],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=$FRONTEND_TG_ARN,containerName=$FRONTEND_SERVICE,containerPort=80"
  
  echo "✅ Created frontend service"
fi

# 9. Create SSM parameters for secrets
echo "🔐 Creating SSM parameters for secrets..."

# Create JWT secret if it doesn't exist
if ! aws ssm get-parameter --name "/catalog-golf/jwt-secret" >/dev/null 2>&1; then
  JWT_SECRET=$(openssl rand -base64 32)
  aws ssm put-parameter \
    --name "/catalog-golf/jwt-secret" \
    --value "$JWT_SECRET" \
    --type "SecureString" \
    --description "JWT secret for Catalog Golf application"
  echo "✅ Created JWT secret parameter"
else
  echo "✅ JWT secret parameter already exists"
fi

# Create database URL parameter if it doesn't exist
if ! aws ssm get-parameter --name "/catalog-golf/database-url" >/dev/null 2>&1; then
  DATABASE_URL="postgresql://catalogadmin:CatalogDB2025!@catalog-golf-db.ckl6kk2cysrq.us-east-1.rds.amazonaws.com:5432/postgres"
  aws ssm put-parameter \
    --name "/catalog-golf/database-url" \
    --value "$DATABASE_URL" \
    --type "SecureString" \
    --description "Database URL for Catalog Golf application"
  echo "✅ Created database URL parameter"
else
  echo "✅ Database URL parameter already exists"
fi

# Clean up temporary files
rm -f /tmp/ecs-task-trust-policy.json /tmp/backend-task-definition.json /tmp/frontend-task-definition.json

echo ""
echo "🎉 ECS infrastructure setup complete!"
echo ""
echo "📊 Summary:"
echo "  • Cluster: $CLUSTER_NAME"
echo "  • Backend Service: $BACKEND_SERVICE"
echo "  • Frontend Service: $FRONTEND_SERVICE"
echo "  • Load Balancer: $ALB_DNS"
echo "  • VPC: $VPC_ID"
echo "  • Security Group: $SECURITY_GROUP_ID"
echo ""
echo "🌐 Your application will be available at:"
echo "  http://$ALB_DNS"
echo ""
echo "⚠️  Note: Services may take 5-10 minutes to become healthy"
echo "🔧 Next steps:"
echo "  1. Push your Docker images to ECR"
echo "  2. Update ECS services to deploy the latest images"
echo "  3. Configure your domain to point to the ALB" 