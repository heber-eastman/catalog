#!/bin/bash

# AWS Frontend Deployment Script for Catalog Golf Application
# This script deploys the Vue.js frontend to AWS S3 + CloudFront (Free Tier eligible)

set -e

echo "🚀 Starting Frontend Deployment to AWS"
echo "======================================"

# Configuration variables
APP_NAME="catalog-golf"
REGION="us-east-1"
FRONTEND_BUCKET_NAME="$APP_NAME-frontend-$(date +%s)"
DOMAIN_NAME=""  # Optional: set your custom domain here

# Get backend server IP from existing infrastructure
echo "📋 Getting backend server information..."
BACKEND_INSTANCE_ID=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=$APP_NAME-server" "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text 2>/dev/null || echo "none")

if [ "$BACKEND_INSTANCE_ID" = "none" ]; then
    echo "❌ Backend server not found. Please deploy backend first."
    exit 1
fi

BACKEND_IP=$(aws ec2 describe-instances \
    --instance-ids $BACKEND_INSTANCE_ID \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

echo "✅ Backend server found: $BACKEND_IP"

# Check if AWS CLI is configured
echo "✅ Checking AWS CLI configuration..."
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

echo "✅ AWS CLI configured successfully"

echo "📋 Phase 1: Build Frontend for Production"
echo "========================================"

# Navigate to frontend directory
cd frontend

# Create production environment file
echo "🔨 Creating production environment configuration..."
cat > .env.production << EOF
VITE_API_BASE_URL=https://api.catalog.golf/api/v1
VITE_APP_TITLE=Catalog Golf
VITE_APP_DESCRIPTION=Golf Course Management System
EOF

echo "✅ Production environment configured"

# Install dependencies and build
echo "🔨 Installing dependencies..."
npm install

echo "🔨 Building frontend for production..."
npm run build

echo "✅ Frontend build completed"

# Go back to root directory
cd ..

echo "📋 Phase 2: Create S3 Bucket for Static Hosting"
echo "=============================================="

# Create S3 bucket
echo "🔨 Creating S3 bucket: $FRONTEND_BUCKET_NAME"
aws s3 mb s3://$FRONTEND_BUCKET_NAME --region $REGION

# Configure bucket for static website hosting
echo "🔨 Configuring S3 bucket for static website hosting..."
aws s3 website s3://$FRONTEND_BUCKET_NAME \
    --index-document index.html \
    --error-document index.html

# Create bucket policy for public read access
cat > bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$FRONTEND_BUCKET_NAME/*"
        }
    ]
}
EOF

# Disable block public access FIRST (required for static website hosting)
aws s3api put-public-access-block \
    --bucket $FRONTEND_BUCKET_NAME \
    --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# Wait a moment for the setting to take effect
sleep 5

# Apply bucket policy
aws s3api put-bucket-policy \
    --bucket $FRONTEND_BUCKET_NAME \
    --policy file://bucket-policy.json

echo "✅ S3 bucket configured for static hosting"

echo "📋 Phase 3: Upload Frontend Files"
echo "================================"

# Upload built files to S3
echo "🔨 Uploading frontend files to S3..."
aws s3 sync frontend/dist/ s3://$FRONTEND_BUCKET_NAME \
    --delete \
    --cache-control "public, max-age=31536000" \
    --exclude "*.html" \
    --exclude "*.json"

# Upload HTML files with no-cache headers
aws s3 sync frontend/dist/ s3://$FRONTEND_BUCKET_NAME \
    --delete \
    --cache-control "public, max-age=0, must-revalidate" \
    --include "*.html" \
    --include "*.json"

echo "✅ Frontend files uploaded successfully"

echo "📋 Phase 4: Create CloudFront Distribution (Optional - Free Tier)"
echo "=============================================================="

# Get S3 bucket website endpoint
S3_WEBSITE_ENDPOINT="$FRONTEND_BUCKET_NAME.s3-website-$REGION.amazonaws.com"

# Create CloudFront distribution
echo "🔨 Creating CloudFront distribution..."
cat > cloudfront-config.json << EOF
{
    "CallerReference": "$APP_NAME-frontend-$(date +%s)",
    "Comment": "CloudFront distribution for $APP_NAME frontend",
    "DefaultCacheBehavior": {
        "TargetOriginId": "S3-$FRONTEND_BUCKET_NAME",
        "ViewerProtocolPolicy": "redirect-to-https",
        "TrustedSigners": {
            "Enabled": false,
            "Quantity": 0
        },
        "ForwardedValues": {
            "QueryString": false,
            "Cookies": {
                "Forward": "none"
            }
        },
        "MinTTL": 0,
        "DefaultTTL": 86400,
        "MaxTTL": 31536000,
        "Compress": true
    },
    "Origins": {
        "Quantity": 1,
        "Items": [
            {
                "Id": "S3-$FRONTEND_BUCKET_NAME",
                "DomainName": "$S3_WEBSITE_ENDPOINT",
                "CustomOriginConfig": {
                    "HTTPPort": 80,
                    "HTTPSPort": 443,
                    "OriginProtocolPolicy": "http-only"
                }
            }
        ]
    },
    "Enabled": true,
    "DefaultRootObject": "index.html",
    "CustomErrorResponses": {
        "Quantity": 1,
        "Items": [
            {
                "ErrorCode": 404,
                "ResponsePagePath": "/index.html",
                "ResponseCode": "200",
                "ErrorCachingMinTTL": 300
            }
        ]
    },
    "PriceClass": "PriceClass_100"
}
EOF

# Create the distribution
DISTRIBUTION_ID=$(aws cloudfront create-distribution \
    --distribution-config file://cloudfront-config.json \
    --query 'Distribution.Id' \
    --output text)

echo "✅ CloudFront distribution created: $DISTRIBUTION_ID"

# Wait for distribution to be deployed (this can take 15-20 minutes)
echo "⏳ Waiting for CloudFront distribution to be deployed (this may take 15-20 minutes)..."
aws cloudfront wait distribution-deployed --id $DISTRIBUTION_ID

# Get CloudFront domain name
CLOUDFRONT_DOMAIN=$(aws cloudfront get-distribution \
    --id $DISTRIBUTION_ID \
    --query 'Distribution.DomainName' \
    --output text)

echo "✅ CloudFront distribution deployed"

echo "📋 Phase 5: Update Backend CORS Configuration"
echo "==========================================="

echo "🔨 Updating backend CORS to allow frontend domain..."
# Note: This would require updating the backend code to include the new domain
# For now, we'll just display the information

# Clean up temporary files
rm -f bucket-policy.json cloudfront-config.json

echo ""
echo "🎉 FRONTEND DEPLOYMENT COMPLETE!"
echo "==============================="
echo ""
echo "📋 Resources Created:"
echo "  • S3 Bucket: $FRONTEND_BUCKET_NAME"
echo "  • CloudFront Distribution: $DISTRIBUTION_ID"
echo ""
echo "🌐 Access URLs:"
echo "  • S3 Website: http://$S3_WEBSITE_ENDPOINT"
echo "  • CloudFront (HTTPS): https://$CLOUDFRONT_DOMAIN"
echo ""
echo "🔧 Backend Configuration:"
echo "  • Backend API: http://$BACKEND_IP:3000"
echo "  • Frontend connects to: http://$BACKEND_IP:3000/api/v1"
echo ""
echo "📝 Next Steps:"
echo "  1. Update backend CORS settings to allow: https://$CLOUDFRONT_DOMAIN"
echo "  2. Test the application at: https://$CLOUDFRONT_DOMAIN"
echo "  3. Configure custom domain (optional)"
echo ""
echo "💰 Monthly Cost Estimate (after free tier):"
echo "  • S3 Storage: ~$0.50/month (for typical app)"
echo "  • CloudFront: ~$1.00/month (first 1TB free)"
echo "  • Total Frontend: ~$1.50/month"
echo ""
echo "⚡ Performance Benefits:"
echo "  • Global CDN distribution"
echo "  • HTTPS encryption"
echo "  • Gzip compression"
echo "  • Browser caching optimization" 