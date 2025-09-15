#!/bin/bash

export AWS_DEFAULT_REGION=us-east-1

echo "=== Frontend Domain Status Check ==="

# Check CloudFront distribution status
echo "CloudFront Distribution Status:"
/opt/homebrew/bin/aws cloudfront get-distribution \
    --id E253LTYDQKHUYE \
    --query 'Distribution.Status' \
    --output text

echo ""

# Check if DNS record exists
echo "Route 53 DNS Records for app.catalog.golf:"
/opt/homebrew/bin/aws route53 list-resource-record-sets \
    --hosted-zone-id Z02766972A977NGTX3R7 \
    --query 'ResourceRecordSets[?contains(Name, `app.catalog.golf`)]' \
    --output table

echo ""

# Check certificate status
echo "SSL Certificate Status:"
/opt/homebrew/bin/aws acm describe-certificate \
    --certificate-arn arn:aws:acm:us-east-1:722895251763:certificate/ef7bc90c-f2c3-4f8f-8980-9c31c8b2610c \
    --query 'Certificate.Status' \
    --output text

echo ""

# Test DNS resolution
echo "DNS Resolution Test:"
nslookup app.catalog.golf || echo "DNS not yet propagated"

echo ""
echo "=== Status Check Complete ===" 