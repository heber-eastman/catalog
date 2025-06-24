#!/bin/bash

# Simple certificate status check
CERT_ARN="arn:aws:acm:us-east-1:722895251763:certificate/c4575455-1125-4a5c-903b-a941c6808b52"

echo "=== Certificate Status ==="
/opt/homebrew/bin/aws acm describe-certificate \
  --certificate-arn "$CERT_ARN" \
  --region us-east-1 \
  --output json > cert_status.json

echo "Certificate status saved to cert_status.json"
echo ""

# Extract status using jq if available, otherwise use grep
if command -v jq >/dev/null 2>&1; then
    echo "Status: $(cat cert_status.json | jq -r '.Certificate.Status')"
    echo "Domain: $(cat cert_status.json | jq -r '.Certificate.DomainName')"
else
    echo "Status: $(grep -o '"Status":"[^"]*"' cert_status.json | cut -d'"' -f4)"
    echo "Domain: $(grep -o '"DomainName":"[^"]*"' cert_status.json | cut -d'"' -f4)"
fi

echo ""
echo "Full certificate details saved in cert_status.json" 