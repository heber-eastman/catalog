#!/bin/bash

# Setup Route 53 Hosted Zone for catalog.golf domain
set -e

echo "🌐 Setting up Route 53 Hosted Zone for catalog.golf..."

DOMAIN_NAME="catalog.golf"
REGION="us-east-1"

echo "📋 Step 1: Create hosted zone for $DOMAIN_NAME..."
ZONE_ID=$(aws route53 create-hosted-zone \
  --name $DOMAIN_NAME \
  --caller-reference "catalog-golf-$(date +%s)" \
  --hosted-zone-config Comment="Hosted zone for catalog.golf domain" \
  --query 'HostedZone.Id' \
  --output text)

# Remove the /hostedzone/ prefix
ZONE_ID=${ZONE_ID#/hostedzone/}
echo "✅ Created hosted zone with ID: $ZONE_ID"

echo "📋 Step 2: Get name servers for the hosted zone..."
NAME_SERVERS=$(aws route53 get-hosted-zone \
  --id $ZONE_ID \
  --query 'DelegationSet.NameServers' \
  --output table)

echo "📋 Name servers for your domain:"
echo "$NAME_SERVERS"

echo ""
echo "🎉 Route 53 Hosted Zone Setup Complete!"
echo ""
echo "📋 IMPORTANT: Update your domain registrar's name servers"
echo "You need to update the name servers at your domain registrar to:"
aws route53 get-hosted-zone --id $ZONE_ID --query 'DelegationSet.NameServers[]' --output text

echo ""
echo "⏳ After updating name servers (can take 24-48 hours to propagate):"
echo "1. Wait for DNS propagation"
echo "2. Run the HTTPS setup script: ./setup-https-backend.sh"
echo ""
echo "🔍 To check DNS propagation:"
echo "dig NS catalog.golf" 