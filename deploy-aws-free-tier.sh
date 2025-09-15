#!/bin/bash

# AWS Free Tier Setup Script for Catalog Golf Application
# This script sets up the application using only AWS free tier resources

set -e

echo "🆓 Starting AWS Free Tier Setup for Catalog Golf Application"
echo "============================================================="

# Configuration variables
APP_NAME="catalog-golf"
REGION="us-east-1"
VPC_CIDR="10.0.0.0/16"
PUBLIC_SUBNET_CIDR="10.0.1.0/24"
PRIVATE_SUBNET_CIDR="10.0.2.0/24"

# Check if AWS CLI is configured
echo "✅ Checking AWS CLI configuration..."
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

echo "✅ AWS CLI configured successfully"

# Get current account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "📋 Account ID: $ACCOUNT_ID"

echo "📋 Phase 1: VPC and Networking (Free Tier)"
echo "==========================================="

# Create VPC
echo "🔨 Creating VPC..."
VPC_ID=$(aws ec2 create-vpc \
    --cidr-block $VPC_CIDR \
    --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=$APP_NAME-vpc},{Key=Environment,Value=free-tier}]" \
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

# Get availability zone
AZ_1=$(aws ec2 describe-availability-zones --query 'AvailabilityZones[0].ZoneName' --output text)

# Create public subnet
echo "🔨 Creating public subnet..."
PUBLIC_SUBNET_ID=$(aws ec2 create-subnet \
    --vpc-id $VPC_ID \
    --cidr-block $PUBLIC_SUBNET_CIDR \
    --availability-zone $AZ_1 \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$APP_NAME-public}]" \
    --query 'Subnet.SubnetId' --output text)

# Enable auto-assign public IP
aws ec2 modify-subnet-attribute --subnet-id $PUBLIC_SUBNET_ID --map-public-ip-on-launch

echo "✅ Public subnet created: $PUBLIC_SUBNET_ID"

# Create private subnet (for RDS)
echo "🔨 Creating private subnet..."
AZ_2=$(aws ec2 describe-availability-zones --query 'AvailabilityZones[1].ZoneName' --output text)
PRIVATE_SUBNET_ID=$(aws ec2 create-subnet \
    --vpc-id $VPC_ID \
    --cidr-block $PRIVATE_SUBNET_CIDR \
    --availability-zone $AZ_2 \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$APP_NAME-private}]" \
    --query 'Subnet.SubnetId' --output text)

echo "✅ Private subnet created: $PRIVATE_SUBNET_ID"

# Create route table for public subnet
echo "🔨 Creating route table..."
PUBLIC_RT_ID=$(aws ec2 create-route-table \
    --vpc-id $VPC_ID \
    --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=$APP_NAME-public-rt}]" \
    --query 'RouteTable.RouteTableId' --output text)

aws ec2 create-route --route-table-id $PUBLIC_RT_ID --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID
aws ec2 associate-route-table --subnet-id $PUBLIC_SUBNET_ID --route-table-id $PUBLIC_RT_ID

echo "✅ Route table configured"

echo "📋 Phase 2: Security Groups (Free)"
echo "=================================="

# Create EC2 security group
echo "🔨 Creating EC2 security group..."
EC2_SG_ID=$(aws ec2 create-security-group \
    --group-name "$APP_NAME-ec2-sg" \
    --description "Security group for EC2 instance" \
    --vpc-id $VPC_ID \
    --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=$APP_NAME-ec2-sg}]" \
    --query 'GroupId' --output text)

# Allow HTTP, SSH
aws ec2 authorize-security-group-ingress --group-id $EC2_SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $EC2_SG_ID --protocol tcp --port 3000 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $EC2_SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0

echo "✅ EC2 Security Group created: $EC2_SG_ID"

# Create RDS security group
echo "🔨 Creating RDS security group..."
RDS_SG_ID=$(aws ec2 create-security-group \
    --group-name "$APP_NAME-rds-sg" \
    --description "Security group for RDS database" \
    --vpc-id $VPC_ID \
    --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=$APP_NAME-rds-sg}]" \
    --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-id $RDS_SG_ID --protocol tcp --port 5432 --source-group $EC2_SG_ID

echo "✅ RDS Security Group created: $RDS_SG_ID"

echo "📋 Phase 3: RDS Database (Free Tier)"
echo "===================================="

# Create DB subnet group (needs 2 subnets in different AZs)
echo "🔨 Creating DB subnet group..."
aws rds create-db-subnet-group \
    --db-subnet-group-name "$APP_NAME-db-subnet-group" \
    --db-subnet-group-description "DB subnet group for $APP_NAME" \
    --subnet-ids $PUBLIC_SUBNET_ID $PRIVATE_SUBNET_ID \
    --tags Key=Name,Value="$APP_NAME-db-subnet-group"

echo "✅ DB subnet group created"

# Create RDS instance (FREE TIER)
echo "🔨 Creating RDS PostgreSQL instance (FREE TIER - db.t3.micro)..."
aws rds create-db-instance \
    --db-instance-identifier "$APP_NAME-db" \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 13.15 \
    --master-username catalogadmin \
    --master-user-password "CatalogDB2025!" \
    --allocated-storage 20 \
    --max-allocated-storage 20 \
    --vpc-security-group-ids $RDS_SG_ID \
    --db-subnet-group-name "$APP_NAME-db-subnet-group" \
    --no-publicly-accessible \
    --backup-retention-period 1 \
    --no-multi-az \
    --tags Key=Name,Value="$APP_NAME-database"

echo "✅ RDS instance creation initiated (FREE TIER - this will take several minutes)"

echo "📋 Phase 4: EC2 Instance (Free Tier)"
echo "===================================="

# Create key pair for SSH access
echo "🔨 Creating key pair..."
aws ec2 create-key-pair \
    --key-name "$APP_NAME-key" \
    --key-type rsa \
    --key-format pem \
    --query 'KeyMaterial' \
    --output text > "$APP_NAME-key.pem"

chmod 400 "$APP_NAME-key.pem"
echo "✅ Key pair created: $APP_NAME-key.pem"

# Get latest Amazon Linux 2 AMI
echo "🔨 Getting latest Amazon Linux 2 AMI..."
AMI_ID=$(aws ec2 describe-images \
    --owners amazon \
    --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" "Name=state,Values=available" \
    --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
    --output text)

echo "✅ Using AMI: $AMI_ID"

# Create user data script for EC2 instance
cat > user-data.sh << 'EOF'
#!/bin/bash
yum update -y
yum install -y docker git

# Start Docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Node.js
curl -sL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# Create application directory
mkdir -p /home/ec2-user/app
chown ec2-user:ec2-user /home/ec2-user/app

echo "Setup complete!" > /home/ec2-user/setup-complete.txt
EOF

# Launch EC2 instance (FREE TIER)
echo "🔨 Launching EC2 instance (FREE TIER - t2.micro)..."
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id $AMI_ID \
    --count 1 \
    --instance-type t2.micro \
    --key-name "$APP_NAME-key" \
    --security-group-ids $EC2_SG_ID \
    --subnet-id $PUBLIC_SUBNET_ID \
    --user-data file://user-data.sh \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$APP_NAME-server}]" \
    --query 'Instances[0].InstanceId' \
    --output text)

echo "✅ EC2 instance launched: $INSTANCE_ID"

# Wait for instance to be running
echo "⏳ Waiting for instance to be running..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

echo "✅ Instance is running at: $PUBLIC_IP"

# Wait for RDS to be available
echo "⏳ Waiting for RDS instance to be available (this can take 10-15 minutes)..."
aws rds wait db-instance-available --db-instance-identifier "$APP_NAME-db"

# Get RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier "$APP_NAME-db" \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text)

echo "✅ RDS instance available at: $RDS_ENDPOINT"

# Clean up temporary files
rm user-data.sh

echo ""
echo "🎉 FREE TIER DEPLOYMENT COMPLETE!"
echo "================================="
echo ""
echo "📋 Resources Created:"
echo "  • VPC: $VPC_ID"
echo "  • EC2 Instance: $INSTANCE_ID (t2.micro - FREE)"
echo "  • RDS Database: $APP_NAME-db (db.t3.micro - FREE)"
echo "  • SSH Key: $APP_NAME-key.pem"
echo ""
echo "🌐 Access Information:"
echo "  • EC2 Public IP: $PUBLIC_IP"
echo "  • SSH Command: ssh -i $APP_NAME-key.pem ec2-user@$PUBLIC_IP"
echo "  • RDS Endpoint: $RDS_ENDPOINT"
echo ""
echo "📝 Next Steps:"
echo "  1. SSH into the EC2 instance"
echo "  2. Clone your repository"
echo "  3. Set up environment variables"
echo "  4. Run your application"
echo ""
echo "💰 Monthly Cost Estimate (after free tier expires):"
echo "  • EC2 t2.micro: ~$8.50/month"
echo "  • RDS db.t3.micro: ~$12.60/month"
echo "  • Total: ~$21/month"
echo ""
echo "⚠️  IMPORTANT: Save the $APP_NAME-key.pem file securely!"
echo "   You'll need it to SSH into your server." 