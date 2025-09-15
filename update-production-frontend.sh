#!/bin/bash

# Update Production CloudFront Distribution
# This script updates the production CloudFront distribution to use the new S3 bucket

set -e

echo "🔄 Updating Production CloudFront Distribution"
echo "============================================="

# Configuration
DISTRIBUTION_ID="E253LTYDQKHUYE"
OLD_BUCKET="catalog-golf-frontend-1750797391.s3-website-us-east-1.amazonaws.com"
NEW_BUCKET="catalog-golf-frontend-1752103044.s3-website-us-east-1.amazonaws.com"

echo "📋 Current Configuration:"
echo "  Distribution ID: $DISTRIBUTION_ID"
echo "  Old S3 Bucket: $OLD_BUCKET"
echo "  New S3 Bucket: $NEW_BUCKET"
echo ""

echo "🔍 Getting current distribution configuration..."
aws cloudfront get-distribution-config --id $DISTRIBUTION_ID > current-cloudfront-config.json

# Extract the ETag for the update
ETAG=$(cat current-cloudfront-config.json | jq -r '.ETag')
echo "  Current ETag: $ETAG"

# Update the distribution config
echo "🔧 Updating distribution configuration..."
cat current-cloudfront-config.json | jq --arg new_bucket "$NEW_BUCKET" '
.DistributionConfig.Origins.Items[0].DomainName = $new_bucket |
.DistributionConfig.Origins.Items[0].Id = $new_bucket |
.DistributionConfig.DefaultCacheBehavior.TargetOriginId = $new_bucket
' > updated-cloudfront-config.json

echo "📤 Applying configuration update..."
aws cloudfront update-distribution \
  --id $DISTRIBUTION_ID \
  --distribution-config file://updated-cloudfront-config.json \
  --if-match $ETAG | cat

echo "🔄 Creating CloudFront invalidation to clear cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)

echo "  Invalidation ID: $INVALIDATION_ID"

echo "⏳ Waiting for distribution update to deploy..."
echo "  This may take 15-20 minutes..."

# Wait for the distribution to be deployed
aws cloudfront wait distribution-deployed --id $DISTRIBUTION_ID

echo "✅ Distribution update deployed successfully!"

echo "🧪 Testing updated frontend..."
sleep 30  # Give it a moment for DNS propagation

echo "  Testing: https://app.catalog.golf"
curl -I https://app.catalog.golf | cat

echo ""
echo "🎉 PRODUCTION FRONTEND UPDATE COMPLETE!"
echo "====================================="
echo ""
echo "✅ CloudFront distribution updated to use new S3 bucket"
echo "✅ Cache invalidated to serve fresh content"
echo "✅ Distribution deployed and ready"
echo ""
echo "🌐 Production URL: https://app.catalog.golf"
echo "🧪 The signup form should now work correctly!"
echo ""
echo "📋 Next Steps:"
echo "  1. Test the signup form at: https://app.catalog.golf"
echo "  2. Verify the API sends the correct nested data structure"
echo "  3. Clean up old S3 bucket if desired" 