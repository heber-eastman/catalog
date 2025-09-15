#!/bin/bash

echo "⏰ Setting up scheduled scaling for ECS services..."

# Variables
CLUSTER_NAME="catalog-golf-cluster"
BACKEND_SERVICE="catalog-golf-backend"
FRONTEND_SERVICE="catalog-golf-frontend"

# Create IAM role for CloudWatch Events to call ECS
echo "🔑 Creating IAM role for CloudWatch Events..."
aws iam create-role \
    --role-name ECS-ScheduledScaling-Role \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "Service": "events.amazonaws.com"
                },
                "Action": "sts:AssumeRole"
            }
        ]
    }' 2>/dev/null || echo "⚠️ Role may already exist"

# Attach policy to role
aws iam attach-role-policy \
    --role-name ECS-ScheduledScaling-Role \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Create custom policy for ECS scaling
aws iam put-role-policy \
    --role-name ECS-ScheduledScaling-Role \
    --policy-name ECS-Scaling-Policy \
    --policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "ecs:UpdateService",
                    "ecs:DescribeServices"
                ],
                "Resource": "*"
            }
        ]
    }'

# Get the role ARN
ROLE_ARN=$(aws iam get-role --role-name ECS-ScheduledScaling-Role --query 'Role.Arn' --output text)

echo "📅 Creating scheduled scaling rules..."

# Scale DOWN at 10 PM EST (3 AM UTC next day) - when traffic is low
aws events put-rule \
    --name ecs-scale-down-nightly \
    --schedule-expression "cron(0 3 * * ? *)" \
    --description "Scale down ECS services at 10 PM EST to save costs"

# Scale UP at 2 PM EST (7 PM UTC) - during business hours
aws events put-rule \
    --name ecs-scale-up-afternoon \
    --schedule-expression "cron(0 19 * * ? *)" \
    --description "Scale up ECS services at 2 PM EST"

# Add targets for scale DOWN event
aws events put-targets \
    --rule ecs-scale-down-nightly \
    --targets "Id"="1","Arn"="arn:aws:ecs:us-east-1:722895251763:cluster/${CLUSTER_NAME}","RoleArn"="${ROLE_ARN}","EcsParameters"="{\"TaskDefinitionArn\":\"arn:aws:ecs:us-east-1:722895251763:task-definition/${BACKEND_SERVICE}:7\",\"LaunchType\":\"FARGATE\",\"DesiredCount\":0}"

aws events put-targets \
    --rule ecs-scale-down-nightly \
    --targets "Id"="2","Arn"="arn:aws:ecs:us-east-1:722895251763:cluster/${CLUSTER_NAME}","RoleArn"="${ROLE_ARN}","EcsParameters"="{\"TaskDefinitionArn\":\"arn:aws:ecs:us-east-1:722895251763:task-definition/${FRONTEND_SERVICE}:2\",\"LaunchType\":\"FARGATE\",\"DesiredCount\":0}"

# Add targets for scale UP event  
aws events put-targets \
    --rule ecs-scale-up-afternoon \
    --targets "Id"="1","Arn"="arn:aws:ecs:us-east-1:722895251763:cluster/${CLUSTER_NAME}","RoleArn"="${ROLE_ARN}","EcsParameters"="{\"TaskDefinitionArn\":\"arn:aws:ecs:us-east-1:722895251763:task-definition/${BACKEND_SERVICE}:7\",\"LaunchType\":\"FARGATE\",\"DesiredCount\":1}"

aws events put-targets \
    --rule ecs-scale-up-afternoon \
    --targets "Id"="2","Arn"="arn:aws:ecs:us-east-1:722895251763:cluster/${CLUSTER_NAME}","RoleArn"="${ROLE_ARN}","EcsParameters"="{\"TaskDefinitionArn\":\"arn:aws:ecs:us-east-1:722895251763:task-definition/${FRONTEND_SERVICE}:2\",\"LaunchType\":\"FARGATE\",\"DesiredCount\":1}"

echo ""
echo "✅ Scheduled scaling setup complete!"
echo ""
echo "📅 Schedule:"
echo "   • Scale UP: Daily at 2 PM EST (7 PM UTC)"
echo "   • Scale DOWN: Daily at 10 PM EST (3 AM UTC next day)"
echo ""
echo "💰 Expected savings: ~16 hours/day = ~480 hours/month"
echo ""
echo "🔧 To modify schedule:"
echo "   aws events put-rule --name ecs-scale-down-nightly --schedule-expression 'cron(0 2 * * ? *)'" 