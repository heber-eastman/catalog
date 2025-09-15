#!/bin/bash

# Simple AWS Frontend Deployment Script for Catalog Golf Application
# This script deploys the Vue.js frontend to AWS S3 only (faster deployment)

set -e

echo "🚀 Starting Simple Frontend Deployment to AWS S3"
echo "==============================================="

# Configuration variables
APP_NAME="catalog-golf"
REGION="us-east-1"
FRONTEND_BUCKET_NAME="$APP_NAME-frontend-simple-$(date +%s)"

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
VITE_API_BASE_URL=http://$BACKEND_IP:3000/api/v1
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
aws s3 sync frontend/dist/ s3://$FRONTEND_BUCKET_NAME --delete

echo "✅ Frontend files uploaded successfully"

# Get S3 website endpoint
S3_WEBSITE_ENDPOINT="$FRONTEND_BUCKET_NAME.s3-website-$REGION.amazonaws.com"

# Clean up temporary files
rm -f bucket-policy.json

echo ""
echo "🎉 SIMPLE FRONTEND DEPLOYMENT COMPLETE!"
echo "======================================"
echo ""
echo "📋 Resources Created:"
echo "  • S3 Bucket: $FRONTEND_BUCKET_NAME"
echo ""
echo "🌐 Access URL:"
echo "  • Frontend Website: http://$S3_WEBSITE_ENDPOINT"
echo ""
echo "🔧 Backend Configuration:"
echo "  • Backend API: http://$BACKEND_IP:3000"
echo "  • Frontend connects to: http://$BACKEND_IP:3000/api/v1"
echo ""
echo "📝 Next Steps:"
echo "  1. Test the application at: http://$S3_WEBSITE_ENDPOINT"
echo "  2. Update backend CORS settings if needed"
echo "  3. For HTTPS and better performance, run: ./deploy-frontend-aws.sh"
echo ""
echo "💰 Monthly Cost Estimate (after free tier):"
echo "  • S3 Storage: ~$0.50/month (for typical app)"
echo "  • S3 Requests: ~$0.10/month"
echo "  • Total: ~$0.60/month"
echo ""
echo "⚡ Quick & Simple:"
echo "  • No CloudFront setup time"
echo "  • Immediate availability"
echo "  • Perfect for testing and development" 