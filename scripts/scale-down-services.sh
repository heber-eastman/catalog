#!/bin/bash

echo "⬇️ Scaling down ECS services to save AWS free tier hours..."

# Variables
CLUSTER_NAME="catalog-golf-cluster"
BACKEND_SERVICE="catalog-golf-backend"
FRONTEND_SERVICE="catalog-golf-frontend"

echo "📉 Scaling backend service to 0 tasks..."
aws ecs update-service \
    --cluster ${CLUSTER_NAME} \
    --service ${BACKEND_SERVICE} \
    --desired-count 0

echo "📉 Scaling frontend service to 0 tasks..."
aws ecs update-service \
    --cluster ${CLUSTER_NAME} \
    --service ${FRONTEND_SERVICE} \
    --desired-count 0

echo "⏳ Waiting for services to scale down..."
sleep 10

# Check status
echo "📊 Current service status:"
aws ecs describe-services \
    --cluster ${CLUSTER_NAME} \
    --services ${BACKEND_SERVICE} ${FRONTEND_SERVICE} \
    --query "services[].{ServiceName:serviceName,DesiredCount:desiredCount,RunningCount:runningCount,PendingCount:pendingCount}" \
    --output table

echo ""
echo "✅ Services scaled down!"
echo "💰 This will save approximately 48 free tier hours per day"
echo ""
echo "🔄 To scale back up manually:"
echo "   bash scripts/scale-up-services.sh"
echo ""
echo "⚠️ Note: Your website will be unavailable until scaled back up" 