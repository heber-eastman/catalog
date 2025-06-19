# AWS Infrastructure Setup for *.devstreet.co

This document outlines the AWS infrastructure configuration required for Section 11 multi-tenant subdomain routing.

## Overview

The application uses subdomain-based multi-tenancy where each golf course gets its own subdomain:
- `pine-valley.devstreet.co` → Pine Valley Golf Course
- `sunset-golf.devstreet.co` → Sunset Golf Course  
- `royal-club.devstreet.co` → Royal Club Golf Course

## Required AWS Services

### 1. Route 53 - DNS Management

#### Hosted Zone Setup
```bash
# Create hosted zone for devstreet.co (if not exists)
aws route53 create-hosted-zone \
  --name devstreet.co \
  --caller-reference "devstreet-$(date +%s)"
```

#### Wildcard DNS Record
```json
{
  "Comment": "Wildcard DNS for multi-tenant subdomains",
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "*.devstreet.co",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [
          {
            "Value": "YOUR_LOAD_BALANCER_IP"
          }
        ]
      }
    }
  ]
}
```

#### CLI Command to Create Wildcard Record
```bash
# Replace YOUR_LOAD_BALANCER_IP with actual IP
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch file://wildcard-dns.json
```

### 2. Application Load Balancer (ALB)

#### ALB Configuration
```json
{
  "Name": "devstreet-alb",
  "Scheme": "internet-facing",
  "Type": "application",
  "IpAddressType": "ipv4",
  "Subnets": [
    "subnet-12345678",
    "subnet-87654321"
  ],
  "SecurityGroups": [
    "sg-web-traffic"
  ],
  "Tags": [
    {
      "Key": "Environment",
      "Value": "production"
    },
    {
      "Key": "Application",
      "Value": "devstreet-catalog"
    }
  ]
}
```

#### Target Group Configuration
```json
{
  "Name": "devstreet-backend",
  "Protocol": "HTTP",
  "Port": 3000,
  "VpcId": "vpc-12345678",
  "HealthCheckProtocol": "HTTP",
  "HealthCheckPath": "/health",
  "HealthCheckIntervalSeconds": 30,
  "HealthyThresholdCount": 2,
  "UnhealthyThresholdCount": 3,
  "TargetType": "instance"
}
```

### 3. SSL/TLS Certificate (ACM)

#### Request Wildcard Certificate
```bash
# Request certificate for *.devstreet.co
aws acm request-certificate \
  --domain-name "*.devstreet.co" \
  --subject-alternative-names "devstreet.co" \
  --validation-method DNS \
  --region us-east-1
```

#### HTTPS Listener Configuration
```json
{
  "LoadBalancerArn": "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/devstreet-alb/1234567890abcdef",
  "Protocol": "HTTPS",
  "Port": 443,
  "Certificates": [
    {
      "CertificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012"
    }
  ],
  "DefaultActions": [
    {
      "Type": "forward",
      "TargetGroupArn": "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/devstreet-backend/1234567890abcdef"
    }
  ]
}
```

## Security Groups

### Web Traffic Security Group
```json
{
  "GroupName": "devstreet-web-traffic",
  "GroupDescription": "Allow HTTP/HTTPS traffic for devstreet application",
  "VpcId": "vpc-12345678",
  "SecurityGroupRules": [
    {
      "IpProtocol": "tcp",
      "FromPort": 80,
      "ToPort": 80,
      "CidrIp": "0.0.0.0/0",
      "Description": "HTTP from anywhere"
    },
    {
      "IpProtocol": "tcp",
      "FromPort": 443,
      "ToPort": 443,
      "CidrIp": "0.0.0.0/0",
      "Description": "HTTPS from anywhere"
    }
  ]
}
```

### Backend Security Group  
```json
{
  "GroupName": "devstreet-backend",
  "GroupDescription": "Allow traffic from ALB to backend instances",
  "VpcId": "vpc-12345678",
  "SecurityGroupRules": [
    {
      "IpProtocol": "tcp",
      "FromPort": 3000,
      "ToPort": 3000,
      "SourceSecurityGroupId": "sg-web-traffic",
      "Description": "Node.js app from ALB"
    }
  ]
}
```

## Environment Configuration

### Environment Variables for Production
```bash
# Backend application environment
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
DB_HOST=your-rds-endpoint.region.rds.amazonaws.com
DB_NAME=catalog_production
DB_USER=catalog_user
DB_PASS=secure_password

# GDPR Compliance
GDPR_RETENTION_DAYS=2555

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
RATE_LIMIT_STRICT_MAX=10

# Session/Security
JWT_SECRET=your-super-secure-jwt-secret-key
COOKIE_SECURE=true
COOKIE_SAME_SITE=strict
```

## Deployment Steps

### 1. Infrastructure Setup
```bash
# 1. Create VPC and subnets (if not exists)
# 2. Create security groups
# 3. Launch RDS instance
# 4. Create ALB and target groups
# 5. Request SSL certificate
# 6. Configure Route 53 DNS
```

### 2. Application Deployment
```bash
# 1. Deploy backend instances
# 2. Register instances with target group
# 3. Configure health checks
# 4. Test subdomain routing
```

### 3. Verification Commands
```bash
# Test DNS resolution
dig *.devstreet.co
nslookup pine-valley.devstreet.co

# Test subdomain routing
curl -H "Host: pine-valley.devstreet.co" https://devstreet.co/health
curl -H "Host: sunset-golf.devstreet.co" https://devstreet.co/health

# Test SSL certificate
openssl s_client -connect pine-valley.devstreet.co:443 -servername pine-valley.devstreet.co
```

## Monitoring and Logging

### CloudWatch Alarms
- ALB target health
- SSL certificate expiration
- DNS query failures
- Rate limiting violations

### Log Groups
- `/aws/elb/devstreet-alb` - Load balancer logs
- `/aws/lambda/devstreet-backend` - Application logs
- Route 53 query logs (optional)

## Cost Optimization

### Reserved Instances
- Use Reserved Instances for stable workloads
- Consider Savings Plans for flexible usage

### Auto Scaling
- Configure Auto Scaling groups based on CPU/memory usage
- Use predictive scaling for known traffic patterns

## Troubleshooting

### Common Issues

1. **DNS Resolution Problems**
   ```bash
   # Check NS records are correctly configured
   dig NS devstreet.co
   
   # Verify wildcard resolution
   dig test-subdomain.devstreet.co
   ```

2. **SSL Certificate Issues**
   ```bash
   # Check certificate status
   aws acm describe-certificate --certificate-arn YOUR_CERT_ARN
   
   # Verify certificate covers wildcards
   openssl x509 -in certificate.pem -text -noout | grep DNS
   ```

3. **Load Balancer Health Checks**
   ```bash
   # Check target group health
   aws elbv2 describe-target-health --target-group-arn YOUR_TG_ARN
   
   # Test health check endpoint
   curl -H "Host: pine-valley.devstreet.co" http://instance-ip:3000/health
   ```

## Security Best Practices

1. **Network Security**
   - Use private subnets for backend instances
   - Implement WAF rules for common attacks
   - Enable VPC Flow Logs

2. **Application Security**
   - Enable rate limiting (implemented in middleware)
   - Use HTTPS only in production
   - Implement proper CORS policies

3. **Data Security**
   - Enable RDS encryption at rest
   - Use encrypted EBS volumes
   - Implement proper IAM roles and policies

4. **GDPR Compliance**
   - Automated data purging (implemented in GDPR service)
   - Data retention policies
   - Audit logging for data access 