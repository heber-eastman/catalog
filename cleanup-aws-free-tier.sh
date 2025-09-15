#!/bin/bash

# AWS Free Tier Cleanup Script
# This script removes all resources created by deploy-aws-free-tier.sh

set -e

APP_NAME="catalog-golf"

echo "🗑️  AWS Free Tier Cleanup for Catalog Golf Application"
echo "======================================================"
echo ""
echo "⚠️  WARNING: This will permanently delete ALL resources!"
echo "   • EC2 Instance and data"
echo "   • RDS Database and all data"
echo "   • VPC and networking components"
echo ""
read -p "Are you sure you want to continue? (type 'DELETE' to confirm): " confirm

if [ "$confirm" != "DELETE" ]; then
    echo "❌ Cleanup cancelled"
    exit 1
fi

echo "🔍 Finding resources to cleanup..."

# Get VPC ID
VPC_ID=$(aws ec2 describe-vpcs \
    --filters "Name=tag:Name,Values=$APP_NAME-vpc" \
    --query 'Vpcs[0].VpcId' \
    --output text)

if [ "$VPC_ID" = "None" ] || [ -z "$VPC_ID" ]; then
    echo "❌ No VPC found with name $APP_NAME-vpc"
    exit 1
fi

echo "✅ Found VPC: $VPC_ID"

echo "📋 Phase 1: Terminate EC2 Instances"
echo "==================================="

# Find and terminate EC2 instances
INSTANCE_IDS=$(aws ec2 describe-instances \
    --filters "Name=vpc-id,Values=$VPC_ID" "Name=instance-state-name,Values=running,pending,stopped,stopping" \
    --query 'Reservations[].Instances[].InstanceId' \
    --output text)

if [ -n "$INSTANCE_IDS" ] && [ "$INSTANCE_IDS" != "None" ]; then
    echo "🗑️  Terminating EC2 instances: $INSTANCE_IDS"
    aws ec2 terminate-instances --instance-ids $INSTANCE_IDS
    
    echo "⏳ Waiting for instances to terminate..."
    aws ec2 wait instance-terminated --instance-ids $INSTANCE_IDS
    echo "✅ EC2 instances terminated"
else
    echo "ℹ️  No EC2 instances found"
fi

echo "📋 Phase 2: Delete RDS Database"
echo "==============================="

# Delete RDS instance
RDS_EXISTS=$(aws rds describe-db-instances \
    --db-instance-identifier "$APP_NAME-db" \
    --query 'DBInstances[0].DBInstanceIdentifier' \
    --output text 2>/dev/null || echo "None")

if [ "$RDS_EXISTS" != "None" ] && [ -n "$RDS_EXISTS" ]; then
    echo "🗑️  Deleting RDS instance: $APP_NAME-db"
    aws rds delete-db-instance \
        --db-instance-identifier "$APP_NAME-db" \
        --skip-final-snapshot \
        --delete-automated-backups
    
    echo "⏳ Waiting for RDS instance to be deleted..."
    aws rds wait db-instance-deleted --db-instance-identifier "$APP_NAME-db"
    echo "✅ RDS instance deleted"
else
    echo "ℹ️  No RDS instance found"
fi

# Delete DB subnet group
DB_SUBNET_GROUP_EXISTS=$(aws rds describe-db-subnet-groups \
    --db-subnet-group-name "$APP_NAME-db-subnet-group" \
    --query 'DBSubnetGroups[0].DBSubnetGroupName' \
    --output text 2>/dev/null || echo "None")

if [ "$DB_SUBNET_GROUP_EXISTS" != "None" ] && [ -n "$DB_SUBNET_GROUP_EXISTS" ]; then
    echo "🗑️  Deleting DB subnet group"
    aws rds delete-db-subnet-group --db-subnet-group-name "$APP_NAME-db-subnet-group"
    echo "✅ DB subnet group deleted"
fi

echo "📋 Phase 3: Delete Key Pair"
echo "==========================="

# Delete key pair
KEY_EXISTS=$(aws ec2 describe-key-pairs \
    --key-names "$APP_NAME-key" \
    --query 'KeyPairs[0].KeyName' \
    --output text 2>/dev/null || echo "None")

if [ "$KEY_EXISTS" != "None" ] && [ -n "$KEY_EXISTS" ]; then
    echo "🗑️  Deleting key pair: $APP_NAME-key"
    aws ec2 delete-key-pair --key-name "$APP_NAME-key"
    echo "✅ Key pair deleted"
    
    # Remove local key file
    if [ -f "$APP_NAME-key.pem" ]; then
        rm "$APP_NAME-key.pem"
        echo "✅ Local key file removed"
    fi
else
    echo "ℹ️  No key pair found"
fi

echo "📋 Phase 4: Delete Security Groups"
echo "=================================="

# Get security group IDs
SECURITY_GROUPS=$(aws ec2 describe-security-groups \
    --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=$APP_NAME-*" \
    --query 'SecurityGroups[].GroupId' \
    --output text)

if [ -n "$SECURITY_GROUPS" ] && [ "$SECURITY_GROUPS" != "None" ]; then
    for SG_ID in $SECURITY_GROUPS; do
        echo "🗑️  Deleting security group: $SG_ID"
        aws ec2 delete-security-group --group-id $SG_ID
    done
    echo "✅ Security groups deleted"
else
    echo "ℹ️  No custom security groups found"
fi

echo "📋 Phase 5: Delete Network Components"
echo "====================================="

# Get subnet IDs
SUBNET_IDS=$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query 'Subnets[].SubnetId' \
    --output text)

# Delete route table associations and route tables
ROUTE_TABLES=$(aws ec2 describe-route-tables \
    --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=$APP_NAME-*" \
    --query 'RouteTables[].RouteTableId' \
    --output text)

if [ -n "$ROUTE_TABLES" ] && [ "$ROUTE_TABLES" != "None" ]; then
    for RT_ID in $ROUTE_TABLES; do
        # Get associations
        ASSOCIATIONS=$(aws ec2 describe-route-tables \
            --route-table-ids $RT_ID \
            --query 'RouteTables[0].Associations[?Main==`false`].RouteTableAssociationId' \
            --output text)
        
        # Delete associations
        if [ -n "$ASSOCIATIONS" ] && [ "$ASSOCIATIONS" != "None" ]; then
            for ASSOC_ID in $ASSOCIATIONS; do
                echo "🗑️  Disassociating route table: $ASSOC_ID"
                aws ec2 disassociate-route-table --association-id $ASSOC_ID
            done
        fi
        
        echo "🗑️  Deleting route table: $RT_ID"
        aws ec2 delete-route-table --route-table-id $RT_ID
    done
    echo "✅ Route tables deleted"
fi

# Detach and delete internet gateway
IGW_ID=$(aws ec2 describe-internet-gateways \
    --filters "Name=attachment.vpc-id,Values=$VPC_ID" \
    --query 'InternetGateways[0].InternetGatewayId' \
    --output text)

if [ -n "$IGW_ID" ] && [ "$IGW_ID" != "None" ]; then
    echo "🗑️  Detaching internet gateway: $IGW_ID"
    aws ec2 detach-internet-gateway --internet-gateway-id $IGW_ID --vpc-id $VPC_ID
    
    echo "🗑️  Deleting internet gateway: $IGW_ID"
    aws ec2 delete-internet-gateway --internet-gateway-id $IGW_ID
    echo "✅ Internet gateway deleted"
fi

# Delete subnets
if [ -n "$SUBNET_IDS" ] && [ "$SUBNET_IDS" != "None" ]; then
    for SUBNET_ID in $SUBNET_IDS; do
        echo "🗑️  Deleting subnet: $SUBNET_ID"
        aws ec2 delete-subnet --subnet-id $SUBNET_ID
    done
    echo "✅ Subnets deleted"
fi

echo "📋 Phase 6: Delete VPC"
echo "======================"

echo "🗑️  Deleting VPC: $VPC_ID"
aws ec2 delete-vpc --vpc-id $VPC_ID
echo "✅ VPC deleted"

echo ""
echo "🎉 CLEANUP COMPLETE!"
echo "==================="
echo ""
echo "All AWS resources have been successfully removed."
echo "Your AWS bill should return to $0.00 (assuming no other resources)."
echo ""
echo "📊 What was deleted:"
echo "  • EC2 instances and key pairs"
echo "  • RDS database and subnet groups"
echo "  • VPC, subnets, and networking"
echo "  • Security groups and route tables"
echo "  • Internet gateway"
echo ""
echo "💡 You can now re-run deploy-aws-free-tier.sh anytime to recreate the infrastructure." 