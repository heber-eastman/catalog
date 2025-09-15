#!/bin/bash

# AWS Setup Script for Catalog Golf Application - Section 12
# This script sets up the complete AWS infrastructure needed for production deployment

set -e

echo "🚀 Starting AWS Setup for Catalog Golf Application"
echo "=================================================="

# Configuration variables
DOMAIN_NAME="catalog.golf"
APP_NAME="catalog-golf"
REGION="us-east-1"
VPC_CIDR="10.0.0.0/16"
PUBLIC_SUBNET_1_CIDR="10.0.1.0/24"
PUBLIC_SUBNET_2_CIDR="10.0.2.0/24"
PRIVATE_SUBNET_1_CIDR="10.0.3.0/24"
PRIVATE_SUBNET_2_CIDR="10.0.4.0/24"

# Check if AWS CLI is configured
echo "✅ Checking AWS CLI configuration..."
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

echo "✅ AWS CLI configured successfully"

# Function to check if resource exists
resource_exists() {
    aws $1 > /dev/null 2>&1
}

echo "📋 Phase 1: VPC and Networking Setup"
echo "===================================="

# Create VPC
echo "🔨 Creating VPC..."
VPC_ID=$(aws ec2 create-vpc \
    --cidr-block $VPC_CIDR \
    --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=$APP_NAME-vpc},{Key=Environment,Value=production}]" \
    --query 'Vpc.VpcId' --output text)

echo "✅ VPC created: $VPC_ID"

# Enable DNS hostnames
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames

# Create Internet Gateway
echo "🔨 Creating Internet Gateway..."
IGW_ID=$(aws ec2 create-internet-gateway \
    --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=$APP_NAME-igw}]" \
    --query 'InternetGateway.InternetGatewayId' --output text)

aws ec2 attach-internet-gateway --vpc-id $VPC_ID --internet-gateway-id $IGW_ID
echo "✅ Internet Gateway created: $IGW_ID"

# Get availability zones
AZ_1=$(aws ec2 describe-availability-zones --query 'AvailabilityZones[0].ZoneName' --output text)
AZ_2=$(aws ec2 describe-availability-zones --query 'AvailabilityZones[1].ZoneName' --output text)

# Create public subnets
echo "🔨 Creating public subnets..."
PUBLIC_SUBNET_1_ID=$(aws ec2 create-subnet \
    --vpc-id $VPC_ID \
    --cidr-block $PUBLIC_SUBNET_1_CIDR \
    --availability-zone $AZ_1 \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$APP_NAME-public-1}]" \
    --query 'Subnet.SubnetId' --output text)

PUBLIC_SUBNET_2_ID=$(aws ec2 create-subnet \
    --vpc-id $VPC_ID \
    --cidr-block $PUBLIC_SUBNET_2_CIDR \
    --availability-zone $AZ_2 \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$APP_NAME-public-2}]" \
    --query 'Subnet.SubnetId' --output text)

echo "✅ Public subnets created: $PUBLIC_SUBNET_1_ID, $PUBLIC_SUBNET_2_ID"

# Create private subnets
echo "🔨 Creating private subnets..."
PRIVATE_SUBNET_1_ID=$(aws ec2 create-subnet \
    --vpc-id $VPC_ID \
    --cidr-block $PRIVATE_SUBNET_1_CIDR \
    --availability-zone $AZ_1 \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$APP_NAME-private-1}]" \
    --query 'Subnet.SubnetId' --output text)

PRIVATE_SUBNET_2_ID=$(aws ec2 create-subnet \
    --vpc-id $VPC_ID \
    --cidr-block $PRIVATE_SUBNET_2_CIDR \
    --availability-zone $AZ_2 \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$APP_NAME-private-2}]" \
    --query 'Subnet.SubnetId' --output text)

echo "✅ Private subnets created: $PRIVATE_SUBNET_1_ID, $PRIVATE_SUBNET_2_ID"

# Create route table for public subnets
echo "🔨 Creating route tables..."
PUBLIC_RT_ID=$(aws ec2 create-route-table \
    --vpc-id $VPC_ID \
    --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=$APP_NAME-public-rt}]" \
    --query 'RouteTable.RouteTableId' --output text)

aws ec2 create-route --route-table-id $PUBLIC_RT_ID --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID
aws ec2 associate-route-table --subnet-id $PUBLIC_SUBNET_1_ID --route-table-id $PUBLIC_RT_ID
aws ec2 associate-route-table --subnet-id $PUBLIC_SUBNET_2_ID --route-table-id $PUBLIC_RT_ID

echo "✅ Route tables configured"

echo "📋 Phase 2: Security Groups"
echo "==========================="

# Create ALB security group
echo "🔨 Creating ALB security group..."
ALB_SG_ID=$(aws ec2 create-security-group \
    --group-name "$APP_NAME-alb-sg" \
    --description "Security group for Application Load Balancer" \
    --vpc-id $VPC_ID \
    --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=$APP_NAME-alb-sg}]" \
    --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-id $ALB_SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $ALB_SG_ID --protocol tcp --port 443 --cidr 0.0.0.0/0

echo "✅ ALB Security Group created: $ALB_SG_ID"

# Create backend security group
echo "🔨 Creating backend security group..."
BACKEND_SG_ID=$(aws ec2 create-security-group \
    --group-name "$APP_NAME-backend-sg" \
    --description "Security group for backend instances" \
    --vpc-id $VPC_ID \
    --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=$APP_NAME-backend-sg}]" \
    --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-id $BACKEND_SG_ID --protocol tcp --port 3000 --source-group $ALB_SG_ID
aws ec2 authorize-security-group-ingress --group-id $BACKEND_SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0

echo "✅ Backend Security Group created: $BACKEND_SG_ID"

# Create RDS security group
echo "🔨 Creating RDS security group..."
RDS_SG_ID=$(aws ec2 create-security-group \
    --group-name "$APP_NAME-rds-sg" \
    --description "Security group for RDS database" \
    --vpc-id $VPC_ID \
    --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=$APP_NAME-rds-sg}]" \
    --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-id $RDS_SG_ID --protocol tcp --port 5432 --source-group $BACKEND_SG_ID

echo "✅ RDS Security Group created: $RDS_SG_ID"

echo "📋 Phase 3: RDS Database"
echo "========================"

# Create DB subnet group
echo "🔨 Creating DB subnet group..."
aws rds create-db-subnet-group \
    --db-subnet-group-name "$APP_NAME-db-subnet-group" \
    --db-subnet-group-description "DB subnet group for $APP_NAME" \
    --subnet-ids $PRIVATE_SUBNET_1_ID $PRIVATE_SUBNET_2_ID \
    --tags Key=Name,Value="$APP_NAME-db-subnet-group"

echo "✅ DB subnet group created"

# Create RDS instance
echo "🔨 Creating RDS PostgreSQL instance..."
aws rds create-db-instance \
    --db-instance-identifier "$APP_NAME-db" \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 13.7 \
    --master-username catalogadmin \
    --master-user-password "CatalogDB2025!" \
    --allocated-storage 20 \
    --vpc-security-group-ids $RDS_SG_ID \
    --db-subnet-group-name "$APP_NAME-db-subnet-group" \
    --no-publicly-accessible \
    --storage-encrypted \
    --backup-retention-period 7 \
    --tags Key=Name,Value="$APP_NAME-database"

echo "✅ RDS instance creation initiated (this will take several minutes)"

echo "📋 Phase 4: Load Balancer"
echo "========================="

# Create Application Load Balancer
echo "🔨 Creating Application Load Balancer..."
ALB_ARN=$(aws elbv2 create-load-balancer \
    --name "$APP_NAME-alb" \
    --subnets $PUBLIC_SUBNET_1_ID $PUBLIC_SUBNET_2_ID \
    --security-groups $ALB_SG_ID \
    --tags Key=Name,Value="$APP_NAME-alb" \
    --query 'LoadBalancers[0].LoadBalancerArn' --output text)

ALB_DNS=$(aws elbv2 describe-load-balancers \
    --load-balancer-arns $ALB_ARN \
    --query 'LoadBalancers[0].DNSName' --output text)

echo "✅ ALB created: $ALB_DNS"

# Create target group
echo "🔨 Creating target group..."
TG_ARN=$(aws elbv2 create-target-group \
    --name "$APP_NAME-backend-tg" \
    --protocol HTTP \
    --port 3000 \
    --vpc-id $VPC_ID \
    --health-check-protocol HTTP \
    --health-check-path /health \
    --health-check-interval-seconds 30 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --tags Key=Name,Value="$APP_NAME-backend-tg" \
    --query 'TargetGroups[0].TargetGroupArn' --output text)

echo "✅ Target group created"

# Create HTTP listener (will redirect to HTTPS later)
aws elbv2 create-listener \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn=$TG_ARN

echo "✅ HTTP listener created"

echo "📋 Phase 5: Route 53 & SSL Certificate"
echo "======================================"

# Check if hosted zone exists
echo "🔍 Checking for existing hosted zone..."
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
    --dns-name $DOMAIN_NAME \
    --query "HostedZones[?Name=='$DOMAIN_NAME.'].Id" \
    --output text 2>/dev/null || echo "")

if [ -z "$HOSTED_ZONE_ID" ]; then
    echo "🔨 Creating hosted zone for $DOMAIN_NAME..."
    HOSTED_ZONE_ID=$(aws route53 create-hosted-zone \
        --name $DOMAIN_NAME \
        --caller-reference "catalog-$(date +%s)" \
        --hosted-zone-config Comment="Hosted zone for Catalog Golf App" \
        --query 'HostedZone.Id' --output text)
    echo "✅ Hosted zone created: $HOSTED_ZONE_ID"
else
    echo "✅ Using existing hosted zone: $HOSTED_ZONE_ID"
fi

# Request SSL certificate
echo "🔨 Requesting SSL certificate..."
CERT_ARN=$(aws acm request-certificate \
    --domain-name "$DOMAIN_NAME" \
    --subject-alternative-names "*.$DOMAIN_NAME" \
    --validation-method DNS \
    --tags Key=Name,Value="$APP_NAME-ssl-cert" \
    --query 'CertificateArn' --output text)

echo "✅ SSL certificate requested: $CERT_ARN"
echo "⚠️  You need to validate the certificate via DNS in the AWS Console"

echo "📋 Phase 6: SES Email Service"
echo "============================="

# Configure SES
echo "🔨 Setting up SES for email notifications..."
aws ses verify-email-identity --email-address "noreply@$DOMAIN_NAME" || echo "⚠️  Email verification initiated"
aws ses verify-domain-identity --domain "$DOMAIN_NAME" || echo "⚠️  Domain verification initiated"

echo "✅ SES setup initiated"

echo "📋 Phase 7: CloudWatch Alarms"
echo "============================="

# Create CloudWatch alarms
echo "🔨 Creating CloudWatch alarms..."

# ALB target health alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "$APP_NAME-unhealthy-targets" \
    --alarm-description "Alarm when ALB has unhealthy targets" \
    --metric-name UnHealthyHostCount \
    --namespace AWS/ApplicationELB \
    --statistic Average \
    --period 300 \
    --threshold 1 \
    --comparison-operator GreaterThanOrEqualToThreshold \
    --evaluation-periods 2 \
    --dimensions Name=LoadBalancer,Value=$(echo $ALB_ARN | cut -d'/' -f2,3,4)

echo "✅ CloudWatch alarms created"

echo "🎉 AWS Infrastructure Setup Complete!"
echo "====================================="
echo ""
echo "📝 IMPORTANT NEXT STEPS:"
echo "========================"
echo ""
echo "1. 🔐 VALIDATE SSL CERTIFICATE:"
echo "   - Go to AWS Certificate Manager console"
echo "   - Add the DNS validation records to Route 53"
echo ""
echo "2. 🌐 UPDATE DNS:"
echo "   - Create A record: *.$DOMAIN_NAME → $ALB_DNS"
echo "   - Create A record: $DOMAIN_NAME → $ALB_DNS"
echo ""
echo "3. 📧 VERIFY SES:"
echo "   - Check your email for SES verification"
echo "   - Add SES DNS records to Route 53"
echo ""
echo "4. 💾 CONFIGURE DATABASE:"
echo "   - Wait for RDS instance to be available (5-10 minutes)"
echo "   - Run database migrations"
echo ""
echo "5. 🚀 DEPLOY APPLICATION:"
echo "   - Create EC2 instances or ECS service"
echo "   - Register instances with target group: $TG_ARN"
echo ""
echo "📊 RESOURCE SUMMARY:"
echo "==================="
echo "VPC ID: $VPC_ID"
echo "ALB DNS: $ALB_DNS"
echo "ALB ARN: $ALB_ARN"
echo "Target Group ARN: $TG_ARN"
echo "Hosted Zone ID: $HOSTED_ZONE_ID"
echo "Certificate ARN: $CERT_ARN"
echo "Public Subnets: $PUBLIC_SUBNET_1_ID, $PUBLIC_SUBNET_2_ID"
echo "Private Subnets: $PRIVATE_SUBNET_1_ID, $PRIVATE_SUBNET_2_ID"
echo "Security Groups: ALB=$ALB_SG_ID, Backend=$BACKEND_SG_ID, RDS=$RDS_SG_ID"
echo ""
echo "💰 ESTIMATED MONTHLY COST: ~$50-100 (depending on usage)"
echo ""
echo "🔗 Useful commands:"
echo "aws rds describe-db-instances --db-instance-identifier $APP_NAME-db"
echo "aws elbv2 describe-target-health --target-group-arn $TG_ARN"
echo "aws acm describe-certificate --certificate-arn $CERT_ARN" 