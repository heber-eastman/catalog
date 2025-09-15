#!/bin/bash

echo "=== Setting up app.catalog.golf for Frontend ==="

# Check if we're in the right region
export AWS_DEFAULT_REGION=us-east-1

# Step 1: Request SSL certificate for app.catalog.golf
echo "Step 1: Requesting SSL certificate for app.catalog.golf..."
FRONTEND_CERT_ARN=$(/opt/homebrew/bin/aws acm request-certificate \
    --domain-name "app.catalog.golf" \
    --validation-method DNS \
    --query 'CertificateArn' \
    --output text)

if [ $? -eq 0 ] && [ "$FRONTEND_CERT_ARN" != "None" ]; then
    echo "Certificate requested successfully: $FRONTEND_CERT_ARN"
else
    echo "Failed to request certificate"
    exit 1
fi

# Step 2: Get validation records
echo "Step 2: Getting DNS validation records..."
sleep 5  # Wait a moment for the certificate to be processed

VALIDATION_RECORD=$(/opt/homebrew/bin/aws acm describe-certificate \
    --certificate-arn "$FRONTEND_CERT_ARN" \
    --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
    --output json)

if [ "$VALIDATION_RECORD" != "null" ] && [ "$VALIDATION_RECORD" != "" ]; then
    echo "Validation record: $VALIDATION_RECORD"
    
    # Extract validation details
    VALIDATION_NAME=$(echo "$VALIDATION_RECORD" | jq -r '.Name')
    VALIDATION_VALUE=$(echo "$VALIDATION_RECORD" | jq -r '.Value')
    
    echo "Validation Name: $VALIDATION_NAME"
    echo "Validation Value: $VALIDATION_VALUE"
    
    # Step 3: Create DNS validation record
    echo "Step 3: Creating DNS validation record..."
    
    # Create the change batch JSON
    cat > frontend-cert-validation.json << EOF
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

    # Apply the DNS record
    CHANGE_ID=$(/opt/homebrew/bin/aws route53 change-resource-record-sets \
        --hosted-zone-id Z02766972A977NGTX3R7 \
        --change-batch file://frontend-cert-validation.json \
        --query 'ChangeInfo.Id' \
        --output text)
    
    if [ $? -eq 0 ]; then
        echo "DNS validation record created successfully: $CHANGE_ID"
        echo "Waiting for DNS propagation and certificate validation..."
        
        # Wait for certificate to be issued (this can take several minutes)
        echo "Waiting for certificate validation (this may take 5-10 minutes)..."
        /opt/homebrew/bin/aws acm wait certificate-validated --certificate-arn "$FRONTEND_CERT_ARN"
        
        if [ $? -eq 0 ]; then
            echo "Certificate validated successfully!"
            
            # Step 4: Get CloudFront distribution ID
            echo "Step 4: Getting CloudFront distribution details..."
            CLOUDFRONT_DIST_ID=$(/opt/homebrew/bin/aws cloudfront list-distributions \
                --query 'DistributionList.Items[0].Id' \
                --output text)
            
            if [ "$CLOUDFRONT_DIST_ID" != "None" ] && [ "$CLOUDFRONT_DIST_ID" != "" ]; then
                echo "Found CloudFront distribution: $CLOUDFRONT_DIST_ID"
                
                # Get current distribution config
                /opt/homebrew/bin/aws cloudfront get-distribution-config \
                    --id "$CLOUDFRONT_DIST_ID" > current-cloudfront-config.json
                
                # Extract ETag and Config properly
                ETAG=$(jq -r '.ETag' current-cloudfront-config.json)
                
                # Extract just the DistributionConfig and update it
                jq --arg cert_arn "$FRONTEND_CERT_ARN" \
                   '.DistributionConfig |
                    .Aliases.Items = ["app.catalog.golf"] |
                    .Aliases.Quantity = 1 |
                    .ViewerCertificate = {
                        "ACMCertificateArn": $cert_arn,
                        "SSLSupportMethod": "sni-only",
                        "MinimumProtocolVersion": "TLSv1.2_2021",
                        "CertificateSource": "acm"
                    }' current-cloudfront-config.json > updated-cloudfront-config.json
                
                # Update CloudFront distribution
                echo "Step 5: Updating CloudFront distribution..."
                /opt/homebrew/bin/aws cloudfront update-distribution \
                    --id "$CLOUDFRONT_DIST_ID" \
                    --distribution-config file://updated-cloudfront-config.json \
                    --if-match "$ETAG" > cloudfront-update-result.json
                
                if [ $? -eq 0 ]; then
                    echo "CloudFront distribution updated successfully!"
                    
                    # Step 6: Create Route 53 record for app.catalog.golf
                    echo "Step 6: Creating Route 53 record for app.catalog.golf..."
                    
                    # Get CloudFront domain name
                    CLOUDFRONT_DOMAIN=$(/opt/homebrew/bin/aws cloudfront get-distribution \
                        --id "$CLOUDFRONT_DIST_ID" \
                        --query 'Distribution.DomainName' \
                        --output text)
                    
                    # Create Route 53 record
                    cat > frontend-dns-record.json << EOF
{
    "Changes": [
        {
            "Action": "CREATE",
            "ResourceRecordSet": {
                "Name": "app.catalog.golf",
                "Type": "A",
                "AliasTarget": {
                    "DNSName": "$CLOUDFRONT_DOMAIN",
                    "EvaluateTargetHealth": false,
                    "HostedZoneId": "Z2FDTNDATAQYW2"
                }
            }
        }
    ]
}
EOF

                    /opt/homebrew/bin/aws route53 change-resource-record-sets \
                        --hosted-zone-id Z02766972A977NGTX3R7 \
                        --change-batch file://frontend-dns-record.json
                    
                    if [ $? -eq 0 ]; then
                        echo "✅ SUCCESS: app.catalog.golf has been configured!"
                        echo ""
                        echo "Summary:"
                        echo "- SSL Certificate: $FRONTEND_CERT_ARN"
                        echo "- CloudFront Distribution: $CLOUDFRONT_DIST_ID"
                        echo "- Domain: app.catalog.golf"
                        echo ""
                        echo "Note: CloudFront deployment may take 10-15 minutes to complete."
                        echo "You can check the status with:"
                        echo "/opt/homebrew/bin/aws cloudfront get-distribution --id $CLOUDFRONT_DIST_ID --query 'Distribution.Status'"
                        
                        # Save configuration for reference
                        echo "{
                            \"frontend_certificate_arn\": \"$FRONTEND_CERT_ARN\",
                            \"cloudfront_distribution_id\": \"$CLOUDFRONT_DIST_ID\",
                            \"domain\": \"app.catalog.golf\"
                        }" > frontend-domain-config.json
                        
                    else
                        echo "❌ Failed to create Route 53 record"
                        exit 1
                    fi
                else
                    echo "❌ Failed to update CloudFront distribution"
                    echo "Error details:"
                    cat cloudfront-update-result.json 2>/dev/null || echo "No error details available"
                    exit 1
                fi
            else
                echo "❌ Could not find CloudFront distribution"
                exit 1
            fi
        else
            echo "❌ Certificate validation failed or timed out"
            exit 1
        fi
    else
        echo "❌ Failed to create DNS validation record"
        exit 1
    fi
else
    echo "❌ Could not get validation record details"
    exit 1
fi

echo "=== Frontend domain setup complete ===" 