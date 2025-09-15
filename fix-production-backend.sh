#!/bin/bash

# Fix Production Backend 502 Error
# This script diagnoses and fixes common issues causing 502 errors in production

set -e

echo "🔍 Diagnosing Production Backend 502 Error"
echo "=========================================="

# Configuration
ECS_CLUSTER="catalog-golf-cluster"
ECS_SERVICE="catalog-golf-backend"
AWS_REGION="us-east-1"

echo "📋 Step 1: Check ECS Service Status"
echo "=================================="

# Check service status
echo "🔍 ECS Service Status:"
aws ecs describe-services \
  --cluster $ECS_CLUSTER \
  --services $ECS_SERVICE \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount,TaskDefinition:taskDefinition}' \
  --output table | cat

# Check task status
echo ""
echo "🔍 ECS Task Status:"
TASK_ARNS=$(aws ecs list-tasks --cluster $ECS_CLUSTER --service-name $ECS_SERVICE --query 'taskArns' --output text)

if [ -n "$TASK_ARNS" ] && [ "$TASK_ARNS" != "None" ]; then
  aws ecs describe-tasks \
    --cluster $ECS_CLUSTER \
    --tasks $TASK_ARNS \
    --query 'tasks[0].{LastStatus:lastStatus,HealthStatus:healthStatus,DesiredStatus:desiredStatus,StoppedReason:stoppedReason}' \
    --output table | cat
else
  echo "❌ No tasks found for service $ECS_SERVICE"
fi

echo ""
echo "📋 Step 2: Check Task Logs"
echo "========================="

if [ -n "$TASK_ARNS" ] && [ "$TASK_ARNS" != "None" ]; then
  echo "🔍 Recent task logs:"
  aws logs tail /ecs/catalog-golf-backend --since 10m --no-cli-pager | head -50 | cat || echo "No recent logs found"
else
  echo "❌ No tasks to check logs for"
fi

echo ""
echo "📋 Step 3: Check Environment Variables"
echo "====================================="

echo "🔍 Checking SSM parameters:"
aws ssm get-parameters \
  --names \
    "/catalog-golf/database-url" \
    "/catalog-golf/jwt-secret" \
    "/catalog-golf/email-queue-url" \
    "/catalog-golf/aws-region" \
  --with-decryption \
  --query 'Parameters[*].{Name:Name,Value:Value}' \
  --output table 2>/dev/null | cat || echo "❌ Some SSM parameters are missing"

echo ""
echo "📋 Step 4: Check Load Balancer Health"
echo "====================================="

# Get target group ARN
TG_ARN=$(aws elbv2 describe-target-groups \
  --names "catalog-golf-backend-tg" \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text 2>/dev/null || echo "None")

if [ "$TG_ARN" != "None" ]; then
  echo "🔍 Target Group Health:"
  aws elbv2 describe-target-health \
    --target-group-arn $TG_ARN \
    --query 'TargetHealthDescriptions[*].{Target:Target.Id,Port:Target.Port,Health:TargetHealth.State,Reason:TargetHealth.Reason}' \
    --output table | cat
else
  echo "❌ Target group not found"
fi

echo ""
echo "📋 Step 5: Restart Service (if needed)"
echo "====================================="

read -p "Do you want to restart the ECS service? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🔄 Restarting ECS service..."
  aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $ECS_SERVICE \
    --force-new-deployment
  
  echo "✅ Service restart initiated. Waiting for deployment..."
  aws ecs wait services-stable \
    --cluster $ECS_CLUSTER \
    --services $ECS_SERVICE
  
  echo "✅ Service restarted successfully"
fi

echo ""
echo "📋 Step 6: Test Health Endpoint"
echo "=============================="

echo "🧪 Testing health endpoint in 30 seconds..."
sleep 30

echo "🔍 Testing https://api.catalog.golf/health"
curl -f https://api.catalog.golf/health || echo "❌ Health check still failing"

echo ""
echo "📋 Step 7: Common Fixes"
echo "======================"

echo "🔧 If the issue persists, try these fixes:"
echo ""
echo "1. Check database connectivity:"
echo "   - Ensure RDS instance is running"
echo "   - Verify security groups allow ECS -> RDS connection"
echo "   - Check DATABASE_URL parameter is correct"
echo ""
echo "2. Check environment variables:"
echo "   aws ssm put-parameter --name '/catalog-golf/jwt-secret' --value 'your-secret' --type SecureString --overwrite"
echo ""
echo "3. Check ECS task definition:"
echo "   - Ensure health check is configured correctly"
echo "   - Verify container port mappings"
echo "   - Check memory/CPU limits"
echo ""
echo "4. Check ALB configuration:"
echo "   - Verify target group health check path is '/health'"
echo "   - Check security groups allow ALB -> ECS communication"
echo ""
echo "5. Manual container test:"
echo "   docker run -p 3000:3000 722895251763.dkr.ecr.us-east-1.amazonaws.com/catalog-golf-backend:latest"

echo ""
echo "🎯 Quick Test Commands:"
echo "====================="
echo "# Test locally built image:"
echo "docker run -p 3000:3000 -e NODE_ENV=production catalog-golf-backend"
echo ""
echo "# Test health endpoint:"
echo "curl http://localhost:3000/health"
echo ""
echo "# Check ECS service events:"
echo "aws ecs describe-services --cluster $ECS_CLUSTER --services $ECS_SERVICE --query 'services[0].events[0:5]' --output table | cat" 