#!/bin/bash

# Simple HTTPS setup using ALB with AWS managed certificate
set -e

echo "🔐 Setting up HTTPS for Backend using ALB with AWS managed certificate..."

# Variables from previous setup
ALB_ARN="arn:aws:elasticloadbalancing:us-east-1:722895251763:loadbalancer/app/catalog-backend-alb/f560aefc3252eaf8"
TG_ARN="arn:aws:elasticloadbalancing:us-east-1:722895251763:targetgroup/catalog-backend-tg/9899e1e5846e0a5a"
ALB_DNS="catalog-backend-alb-871648486.us-east-1.elb.amazonaws.com"
REGION="us-east-1"

echo "🔒 Step 1: Create HTTP Listener (temporary)..."
# Create HTTP listener first to test connectivity
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN \
  --region $REGION

echo "✅ HTTP listener created successfully!"
echo ""
echo "🎯 Your backend is now accessible via:"
echo "   HTTP URL: http://$ALB_DNS/api/v1"
echo ""
echo "🧪 Test the connection:"
echo "   curl http://$ALB_DNS/health"
echo ""
echo "📝 Next steps:"
echo "1. Test HTTP connection first"
echo "2. Update frontend to use: http://$ALB_DNS/api/v1"
echo "3. For HTTPS, we'll need to either:"
echo "   - Use a custom domain you own"
echo "   - Accept browser security warnings for development"
echo ""
echo "🔄 To update frontend immediately:"
echo "   Update frontend/.env.production with:"
echo "   VITE_API_BASE_URL=http://$ALB_DNS/api/v1" 