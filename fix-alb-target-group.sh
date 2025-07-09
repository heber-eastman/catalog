#!/bin/bash

# Fix ALB Target Group Mismatch
# This script updates the ECS service to use the correct target group

set -e

echo "🔧 Fixing ALB Target Group Mismatch"
echo "=================================="

# Configuration
ECS_CLUSTER="catalog-golf-cluster"
ECS_SERVICE="catalog-golf-backend"
CORRECT_TARGET_GROUP="arn:aws:elasticloadbalancing:us-east-1:722895251763:targetgroup/catalog-golf-backend-tg-v2/60ed6342a4cae2b6"

echo "📋 Current ECS Service Configuration:"
aws ecs describe-services \
  --cluster $ECS_CLUSTER \
  --services $ECS_SERVICE \
  --query 'services[0].{TargetGroup:loadBalancers[0].targetGroupArn,TaskDefinition:taskDefinition,Status:status}' \
  --output table | cat

echo ""
echo "🔄 Updating ECS Service to use correct target group..."

# Get current task definition
CURRENT_TASK_DEF=$(aws ecs describe-services \
  --cluster $ECS_CLUSTER \
  --services $ECS_SERVICE \
  --query 'services[0].taskDefinition' \
  --output text)

echo "📋 Current Task Definition: $CURRENT_TASK_DEF"

# Update the service with the correct target group
aws ecs update-service \
  --cluster $ECS_CLUSTER \
  --service $ECS_SERVICE \
  --load-balancers targetGroupArn=$CORRECT_TARGET_GROUP,containerName=catalog-golf-backend,containerPort=3000 \
  --query 'service.{Status:status,TaskDefinition:taskDefinition,LoadBalancers:loadBalancers}' \
  --output table | cat

echo ""
echo "⏳ Waiting for service to stabilize..."
aws ecs wait services-stable --cluster $ECS_CLUSTER --services $ECS_SERVICE

echo ""
echo "✅ Service update completed!"

echo ""
echo "🔍 Checking new target group health:"
aws elbv2 describe-target-health \
  --target-group-arn $CORRECT_TARGET_GROUP \
  --query 'TargetHealthDescriptions[*].{Target:Target.Id,Port:Target.Port,Health:TargetHealth.State}' \
  --output table | cat

echo ""
echo "🧪 Testing the endpoint:"
echo "Waiting 30 seconds for targets to register..."
sleep 30

curl -I https://api.catalog.golf/health || echo "Still not ready, may need more time"

echo ""
echo "🎉 Fix completed! The ECS service now uses the correct target group." 