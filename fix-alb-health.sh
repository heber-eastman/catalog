#!/bin/bash

echo "🔍 Diagnosing ALB Health Issues for api.catalog.golf"
echo "=================================================="

# Set AWS pager to avoid formatting issues
export AWS_PAGER=""

# Get the ALB ARN
ALB_ARN=$(aws elbv2 describe-load-balancers --names catalog-backend-alb --region us-east-1 --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null)

if [ -z "$ALB_ARN" ] || [ "$ALB_ARN" = "None" ]; then
    echo "❌ Could not find ALB. Checking all load balancers..."
    aws elbv2 describe-load-balancers --region us-east-1 --query 'LoadBalancers[].{Name:LoadBalancerName,DNS:DNSName,State:State.Code}' --output table 2>/dev/null || echo "AWS CLI not configured or no access"
    exit 1
fi

echo "✅ Found ALB: $ALB_ARN"

# Get target groups
echo ""
echo "🎯 Checking Target Groups..."
TG_ARN=$(aws elbv2 describe-target-groups --load-balancer-arn "$ALB_ARN" --region us-east-1 --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null)

if [ -z "$TG_ARN" ] || [ "$TG_ARN" = "None" ]; then
    echo "❌ Could not find target group"
    exit 1
fi

echo "✅ Found Target Group: $TG_ARN"

# Check target health
echo ""
echo "🏥 Target Health Status:"
aws elbv2 describe-target-health --target-group-arn "$TG_ARN" --region us-east-1 --output table

# Check ALB availability zones
echo ""
echo "🌍 ALB Availability Zones:"
aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" --region us-east-1 --query 'LoadBalancers[0].AvailabilityZones[*].{Zone:ZoneName,SubnetId:SubnetId}' --output table

# Check running instances
echo ""
echo "🖥️  Running EC2 Instances:"
aws ec2 describe-instances --region us-east-1 --filters "Name=instance-state-name,Values=running" --query 'Reservations[*].Instances[*].{InstanceId:InstanceId,AZ:Placement.AvailabilityZone,PrivateIP:PrivateIpAddress,Name:Tags[?Key==`Name`].Value|[0]}' --output table

# DNS resolution test
echo ""
echo "🔍 DNS Resolution Test:"
nslookup api.catalog.golf

# Test both IPs
echo ""
echo "🧪 Testing IP Addresses:"
IPS=$(nslookup api.catalog.golf | grep "Address:" | grep -v "#" | awk '{print $2}')
for IP in $IPS; do
    echo "Testing $IP..."
    timeout 10 curl -I https://$IP/health -H "Host: api.catalog.golf" 2>/dev/null && echo "✅ $IP responds" || echo "❌ $IP timeout/error"
done

echo ""
echo "📋 Recommendations:"
echo "1. 🚀 IMMEDIATE: Enhanced frontend retry logic has been deployed"
echo "2. 🔧 INFRASTRUCTURE: Consider adding a second instance in us-east-1b"
echo "3. 🎯 ALTERNATIVE: Use Route 53 health checks with weighted routing"
echo "4. 💡 QUICK FIX: Use CloudFront with origin failover"

echo ""
echo "🔧 Quick Fix Command (add current instance to target group with cross-zone enabled):"
INSTANCE_ID=$(aws ec2 describe-instances --region us-east-1 --filters "Name=tag:Name,Values=catalog-golf-server" "Name=instance-state-name,Values=running" --query 'Reservations[0].Instances[0].InstanceId' --output text)
echo "aws elbv2 modify-target-group-attributes --target-group-arn $TG_ARN --attributes Key=load_balancing.cross_zone.enabled,Value=true --region us-east-1"

echo ""
echo "✅ Diagnosis complete!" 