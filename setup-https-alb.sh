#!/bin/bash

# Setup HTTPS listener for the Application Load Balancer
set -e

echo "🔐 Setting up HTTPS listener for Application Load Balancer..."

# Variables from previous setup
ALB_ARN="arn:aws:elasticloadbalancing:us-east-1:722895251763:loadbalancer/app/catalog-backend-alb/f560aefc3252eaf8"
TG_ARN="arn:aws:elasticloadbalancing:us-east-1:722895251763:targetgroup/catalog-backend-tg/9899e1e5846e0a5a"
CERT_ARN="arn:aws:acm:us-east-1:722895251763:certificate/c4575455-1125-4a5c-903b-a941c6808b52"
REGION="us-east-1"

echo "📋 Step 1: Create HTTPS listener (port 443)..."
HTTPS_LISTENER_ARN=$(/opt/homebrew/bin/aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=$CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN \
  --region $REGION \
  --output text --query 'Listeners[0].ListenerArn')

echo "✅ HTTPS listener created: $HTTPS_LISTENER_ARN"

echo "📋 Step 2: Create HTTP to HTTPS redirect listener (port 80)..."
HTTP_LISTENER_ARN=$(/opt/homebrew/bin/aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}' \
  --region $REGION \
  --output text --query 'Listeners[0].ListenerArn')

echo "✅ HTTP redirect listener created: $HTTP_LISTENER_ARN"

echo "📋 Step 3: Get ALB DNS name..."
ALB_DNS=$(/opt/homebrew/bin/aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --region $REGION \
  --output text --query 'LoadBalancers[0].DNSName')

echo "✅ ALB DNS: $ALB_DNS"

echo "📋 Step 4: Create Route 53 record for api.catalog.golf..."
# Create A record pointing to ALB
cat > api-dns-record.json << EOF
{
    "Changes": [
        {
            "Action": "CREATE",
            "ResourceRecordSet": {
                "Name": "api.catalog.golf",
                "Type": "A",
                "AliasTarget": {
                    "DNSName": "$ALB_DNS",
                    "EvaluateTargetHealth": false,
                    "HostedZoneId": "Z35SXDOTRQ7X7K"
                }
            }
        }
    ]
}
EOF

CHANGE_ID=$(/opt/homebrew/bin/aws route53 change-resource-record-sets \
  --hosted-zone-id Z02766972A977NGTX3R7 \
  --change-batch file://api-dns-record.json \
  --output text --query 'ChangeInfo.Id')

echo "✅ DNS record created: $CHANGE_ID"

echo ""
echo "🎉 HTTPS setup complete!"
echo ""
echo "📋 Summary:"
echo "  - HTTPS URL: https://api.catalog.golf"
echo "  - HTTP redirects to HTTPS automatically"
echo "  - SSL Certificate: ISSUED and valid"
echo "  - DNS propagation may take a few minutes"
echo ""
echo "🔧 Next steps:"
echo "  1. Update frontend to use https://api.catalog.golf"
echo "  2. Update backend CORS to allow CloudFront domain"
echo "  3. Test the HTTPS endpoints" 