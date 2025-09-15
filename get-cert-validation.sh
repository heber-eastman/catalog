#!/bin/bash

# Get certificate validation information
CERT_ARN="arn:aws:acm:us-east-1:722895251763:certificate/c4575455-1125-4a5c-903b-a941c6808b52"

echo "Getting certificate validation information..."
aws acm describe-certificate --certificate-arn $CERT_ARN --region us-east-1 --query 'Certificate.DomainValidationOptions[0].ResourceRecord' --output table

echo ""
echo "Certificate status:"
aws acm describe-certificate --certificate-arn $CERT_ARN --region us-east-1 --query 'Certificate.Status' --output text 