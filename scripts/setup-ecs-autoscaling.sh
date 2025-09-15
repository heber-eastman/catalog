#!/bin/bash

echo "🚀 Setting up ECS Auto Scaling for cost optimization..."

# Variables
CLUSTER_NAME="catalog-golf-cluster"
BACKEND_SERVICE="catalog-golf-backend"
FRONTEND_SERVICE="catalog-golf-frontend"

# Create Application Auto Scaling targets for backend
echo "📊 Setting up auto scaling for backend service..."
aws application-autoscaling register-scalable-target \
    --service-namespace ecs \
    --scalable-dimension ecs:service:DesiredCount \
    --resource-id service/${CLUSTER_NAME}/${BACKEND_SERVICE} \
    --min-capacity 0 \
    --max-capacity 2

# Create Application Auto Scaling targets for frontend  
echo "📊 Setting up auto scaling for frontend service..."
aws application-autoscaling register-scalable-target \
    --service-namespace ecs \
    --scalable-dimension ecs:service:DesiredCount \
    --resource-id service/${CLUSTER_NAME}/${FRONTEND_SERVICE} \
    --min-capacity 0 \
    --max-capacity 2

# Create scaling policy for backend (scale up on high CPU)
echo "⬆️ Creating scale-up policy for backend..."
aws application-autoscaling put-scaling-policy \
    --service-namespace ecs \
    --scalable-dimension ecs:service:DesiredCount \
    --resource-id service/${CLUSTER_NAME}/${BACKEND_SERVICE} \
    --policy-name ${BACKEND_SERVICE}-scale-up \
    --policy-type TargetTrackingScaling \
    --target-tracking-scaling-policy-configuration '{
        "TargetValue": 70.0,
        "PredefinedMetricSpecification": {
            "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
        },
        "ScaleOutCooldown": 60,
        "ScaleInCooldown": 300
    }'

# Create scaling policy for frontend (scale up on high CPU)
echo "⬆️ Creating scale-up policy for frontend..."
aws application-autoscaling put-scaling-policy \
    --service-namespace ecs \
    --scalable-dimension ecs:service:DesiredCount \
    --resource-id service/${CLUSTER_NAME}/${FRONTEND_SERVICE} \
    --policy-name ${FRONTEND_SERVICE}-scale-up \
    --policy-type TargetTrackingScaling \
    --target-tracking-scaling-policy-configuration '{
        "TargetValue": 70.0,
        "PredefinedMetricSpecification": {
            "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
        },
        "ScaleOutCooldown": 60,
        "ScaleInCooldown": 300
    }'

# Create CloudWatch alarms for request-based scaling
echo "🔔 Setting up CloudWatch alarms for ALB request count..."

# Get ALB target group ARN
ALB_TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups --query "TargetGroups[?contains(TargetGroupName, 'catalog-golf')].TargetGroupArn" --output text)

if [ -n "$ALB_TARGET_GROUP_ARN" ]; then
    # Extract the target group name for the alarm
    TARGET_GROUP_FULL_NAME=$(echo $ALB_TARGET_GROUP_ARN | cut -d'/' -f2-3)
    
    # Create alarm to scale up when requests > 0
    aws cloudwatch put-metric-alarm \
        --alarm-name "${BACKEND_SERVICE}-scale-up-on-requests" \
        --alarm-description "Scale up ECS service when ALB receives requests" \
        --metric-name RequestCount \
        --namespace AWS/ApplicationELB \
        --statistic Sum \
        --period 60 \
        --threshold 1 \
        --comparison-operator GreaterThanOrEqualToThreshold \
        --evaluation-periods 1 \
        --alarm-actions "arn:aws:sns:us-east-1:722895251763:ecs-scaling-topic" \
        --dimensions Name=TargetGroup,Value=${TARGET_GROUP_FULL_NAME}
        
    echo "✅ CloudWatch alarm created for request-based scaling"
else
    echo "⚠️ Could not find ALB target group for request-based scaling"
fi

echo "🎉 Auto scaling setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Run 'bash scripts/scale-down-services.sh' to immediately scale down to 0"
echo "2. Services will auto-scale up when they receive traffic"
echo "3. Consider setting up scheduled scaling for predictable traffic patterns" 