#!/bin/bash

echo "⬆️ Scaling up ECS services..."

# Variables
CLUSTER_NAME="catalog-golf-cluster"
BACKEND_SERVICE="catalog-golf-backend"
FRONTEND_SERVICE="catalog-golf-frontend"

echo "📈 Scaling backend service to 1 task..."
aws ecs update-service \
    --cluster ${CLUSTER_NAME} \
    --service ${BACKEND_SERVICE} \
    --desired-count 1

echo "📈 Scaling frontend service to 1 task..."
aws ecs update-service \
    --cluster ${CLUSTER_NAME} \
    --service ${FRONTEND_SERVICE} \
    --desired-count 1

echo "⏳ Waiting for services to scale up..."
sleep 30

# Check status
echo "📊 Current service status:"
aws ecs describe-services \
    --cluster ${CLUSTER_NAME} \
    --services ${BACKEND_SERVICE} ${FRONTEND_SERVICE} \
    --query "services[].{ServiceName:serviceName,DesiredCount:desiredCount,RunningCount:runningCount,PendingCount:pendingCount}" \
    --output table

echo ""
echo "✅ Services scaled up!"
echo "🌐 Your website should be available again in a few minutes" 