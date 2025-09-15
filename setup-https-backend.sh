#!/bin/bash

# Setup HTTPS for Backend using AWS Application Load Balancer with catalog.golf domain
# This script creates an ALB with SSL certificate for HTTPS access

set -e

echo "🔐 Setting up HTTPS for Backend using AWS Application Load Balancer..."

# Variables
REGION="us-east-1"
VPC_ID=""
SUBNET_IDS=""
INSTANCE_ID="i-0a6b0ce4a539e5701"
DOMAIN_NAME="api.catalog.golf"  # Using your actual domain
ZONE_ID=""  # We'll get this from Route 53

echo "📋 Step 1: Get VPC and Subnet information..."
# Get VPC ID
VPC_ID=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --region $REGION --query 'Reservations[0].Instances[0].VpcId' --output text)
echo "VPC ID: $VPC_ID"

# Get Subnet IDs (we need at least 2 subnets in different AZs for ALB)
SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --region $REGION --query 'Subnets[*].SubnetId' --output text | tr '\t' ' ')
echo "Subnet IDs: $SUBNET_IDS"

# Convert to array and take first 2
SUBNET_ARRAY=($SUBNET_IDS)
SUBNET1=${SUBNET_ARRAY[0]}
SUBNET2=${SUBNET_ARRAY[1]}

# Get Security Group ID from the existing EC2 instance
SECURITY_GROUP_ID=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --region $REGION --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' --output text)
echo "Security Group ID: $SECURITY_GROUP_ID"

echo "📋 Step 2: Get Route 53 Hosted Zone ID for catalog.golf..."
ZONE_ID=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='catalog.golf.'].Id" --output text)
if [ -z "$ZONE_ID" ]; then
    echo "❌ No hosted zone found for catalog.golf. Please ensure you have a Route 53 hosted zone set up."
    exit 1
fi
# Remove the /hostedzone/ prefix
ZONE_ID=${ZONE_ID#/hostedzone/}
echo "Zone ID: $ZONE_ID"

echo "🔒 Step 3: Request SSL Certificate from AWS Certificate Manager..."
CERT_ARN=$(aws acm request-certificate \
  --domain-name $DOMAIN_NAME \
  --validation-method DNS \
  --region $REGION \
  --query 'CertificateArn' \
  --output text)

echo "Certificate ARN: $CERT_ARN"

echo "📋 Step 4: Get DNS validation records..."
sleep 10  # Wait for certificate to be processed

VALIDATION_RECORDS=$(aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region $REGION \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
  --output json)

VALIDATION_NAME=$(echo $VALIDATION_RECORDS | jq -r '.Name')
VALIDATION_VALUE=$(echo $VALIDATION_RECORDS | jq -r '.Value')

echo "Validation Name: $VALIDATION_NAME"
echo "Validation Value: $VALIDATION_VALUE"

echo "🔗 Step 5: Create DNS validation record in Route 53..."
cat > /tmp/validation-record.json << EOF
{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "$VALIDATION_NAME",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [
          {
            "Value": "$VALIDATION_VALUE"
          }
        ]
      }
    }
  ]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch file:///tmp/validation-record.json

echo "⏳ Step 6: Waiting for certificate validation (this may take a few minutes)..."
aws acm wait certificate-validated --certificate-arn $CERT_ARN --region $REGION

echo "✅ Certificate validated successfully!"

echo "🏗️  Step 7: Create Application Load Balancer..."
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name catalog-backend-alb \
  --subnets $SUBNET1 $SUBNET2 \
  --security-groups $SECURITY_GROUP_ID \
  --region $REGION \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

echo "ALB ARN: $ALB_ARN"

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --region $REGION \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

echo "ALB DNS: $ALB_DNS"

echo "🎯 Step 8: Create Target Group..."
TG_ARN=$(aws elbv2 create-target-group \
  --name catalog-backend-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id $VPC_ID \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 10 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region $REGION \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

echo "Target Group ARN: $TG_ARN"

echo "🔗 Step 9: Register EC2 instance with Target Group..."
aws elbv2 register-targets \
  --target-group-arn $TG_ARN \
  --targets Id=$INSTANCE_ID,Port=3000 \
  --region $REGION

echo "🔒 Step 10: Create HTTPS Listener..."
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=$CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN \
  --region $REGION

echo "🔗 Step 11: Create Route 53 record for api.catalog.golf..."
cat > /tmp/api-record.json << EOF
{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "$DOMAIN_NAME",
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

aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch file:///tmp/api-record.json

echo "🎉 HTTPS Backend Setup Complete!"
echo ""
echo "📋 Summary:"
echo "• Backend API URL: https://$DOMAIN_NAME"
echo "• SSL Certificate: $CERT_ARN"
echo "• Load Balancer: $ALB_ARN"
echo "• Target Group: $TG_ARN"
echo ""
echo "⏳ Please wait 2-3 minutes for DNS propagation, then test:"
echo "curl https://$DOMAIN_NAME/health"
echo ""
echo "🔧 Next steps:"
echo "1. Update your frontend to use https://$DOMAIN_NAME as the API base URL"
echo "2. Update CORS in backend to allow your CloudFront domain"
echo "3. Redeploy frontend with new API URL"

# Clean up temporary files
rm -f /tmp/validation-record.json /tmp/api-record.json 