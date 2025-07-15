#!/bin/bash

echo "⏰ Setting up scheduled scaling for ECS services..."

# Variables
CLUSTER_NAME="catalog-golf-cluster"
BACKEND_SERVICE="catalog-golf-backend"
FRONTEND_SERVICE="catalog-golf-frontend"

# Create Lambda function for ECS scaling
echo "⚡ Creating Lambda function for ECS scaling..."
mkdir -p /tmp/ecs-lambda
cat > /tmp/ecs-lambda/index.js << 'EOF'
const AWS = require('aws-sdk');
const ecs = new AWS.ECS();

exports.handler = async (event) => {
    const action = event.action; // 'scale-up' or 'scale-down'
    const clusterName = event.clusterName;
    const services = event.services;
    
    console.log(`Starting ${action} for cluster: ${clusterName}`);
    
    try {
        for (const service of services) {
            const desiredCount = action === 'scale-up' ? 1 : 0;
            
            console.log(`${action === 'scale-up' ? 'Scaling up' : 'Scaling down'} service: ${service.name} to ${desiredCount} tasks`);
            
            await ecs.updateService({
                cluster: clusterName,
                service: service.name,
                desiredCount: desiredCount
            }).promise();
            
            console.log(`✅ ${service.name} scaled to ${desiredCount} tasks`);
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify(`${action} completed for ${services.length} services`)
        };
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
};
EOF

# Create deployment package
cd /tmp/ecs-lambda
zip -r ecs-scheduler.zip .

# Create IAM role for Lambda
echo "🔑 Creating IAM role for Lambda..."
aws iam create-role \
    --role-name ECS-Lambda-Scheduler-Role \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "Service": "lambda.amazonaws.com"
                },
                "Action": "sts:AssumeRole"
            }
        ]
    }' 2>/dev/null || echo "⚠️ Role may already exist"

# Attach basic Lambda execution policy
aws iam attach-role-policy \
    --role-name ECS-Lambda-Scheduler-Role \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create custom policy for ECS operations
aws iam put-role-policy \
    --role-name ECS-Lambda-Scheduler-Role \
    --policy-name ECS-Operations-Policy \
    --policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "ecs:UpdateService",
                    "ecs:DescribeServices",
                    "ecs:ListServices"
                ],
                "Resource": "*"
            }
        ]
    }'

# Wait for role to be available
sleep 10

# Create Lambda function
aws lambda create-function \
    --function-name ecs-scheduler \
    --runtime nodejs18.x \
    --role arn:aws:iam::722895251763:role/ECS-Lambda-Scheduler-Role \
    --handler index.handler \
    --zip-file fileb://ecs-scheduler.zip \
    --timeout 60 \
    --description "Lambda function to scale ECS services on schedule" \
    2>/dev/null || aws lambda update-function-code \
    --function-name ecs-scheduler \
    --zip-file fileb://ecs-scheduler.zip

# Get Lambda function ARN
LAMBDA_ARN=$(aws lambda get-function --function-name ecs-scheduler --query 'Configuration.FunctionArn' --output text)

echo "📅 Creating scheduled scaling rules..."

# Scale UP at 2 PM EST (7 PM UTC)
aws events put-rule \
    --name ecs-scale-up-afternoon \
    --schedule-expression "cron(0 19 * * ? *)" \
    --description "Scale up ECS services at 2 PM EST"

# Scale DOWN at 10 PM EST (3 AM UTC next day)
aws events put-rule \
    --name ecs-scale-down-nightly \
    --schedule-expression "cron(0 3 * * ? *)" \
    --description "Scale down ECS services at 10 PM EST"

# Add Lambda permissions for CloudWatch Events
aws lambda add-permission \
    --function-name ecs-scheduler \
    --statement-id allow-cloudwatch-scale-up \
    --action lambda:InvokeFunction \
    --principal events.amazonaws.com \
    --source-arn arn:aws:events:us-east-1:722895251763:rule/ecs-scale-up-afternoon \
    2>/dev/null || echo "Permission may already exist"

aws lambda add-permission \
    --function-name ecs-scheduler \
    --statement-id allow-cloudwatch-scale-down \
    --action lambda:InvokeFunction \
    --principal events.amazonaws.com \
    --source-arn arn:aws:events:us-east-1:722895251763:rule/ecs-scale-down-nightly \
    2>/dev/null || echo "Permission may already exist"

# Create the event payload for scaling up
SCALE_UP_INPUT='{
    "action": "scale-up",
    "clusterName": "'${CLUSTER_NAME}'",
    "services": [
        {"name": "'${BACKEND_SERVICE}'"},
        {"name": "'${FRONTEND_SERVICE}'"}
    ]
}'

# Create the event payload for scaling down
SCALE_DOWN_INPUT='{
    "action": "scale-down",
    "clusterName": "'${CLUSTER_NAME}'",
    "services": [
        {"name": "'${BACKEND_SERVICE}'"},
        {"name": "'${FRONTEND_SERVICE}'"}
    ]
}'

# Add targets for scale UP
aws events put-targets \
    --rule ecs-scale-up-afternoon \
    --targets "Id"="1","Arn"="${LAMBDA_ARN}","Input"="${SCALE_UP_INPUT}"

# Add targets for scale DOWN
aws events put-targets \
    --rule ecs-scale-down-nightly \
    --targets "Id"="1","Arn"="${LAMBDA_ARN}","Input"="${SCALE_DOWN_INPUT}"

# Cleanup
rm -rf /tmp/ecs-lambda

echo ""
echo "✅ Scheduled scaling setup complete!"
echo ""
echo "📅 Schedule:"
echo "   • Scale UP: Daily at 2 PM EST (7 PM UTC)"
echo "   • Scale DOWN: Daily at 10 PM EST (3 AM UTC next day)"
echo ""
echo "💰 Expected savings: ~16 hours/day = ~480 hours/month"
echo ""
echo "🔧 To test the scaling manually:"
echo "   # Scale down now:"
echo "   aws lambda invoke --function-name ecs-scheduler --payload '${SCALE_DOWN_INPUT}' /tmp/response.json"
echo "   # Scale up now:"
echo "   aws lambda invoke --function-name ecs-scheduler --payload '${SCALE_UP_INPUT}' /tmp/response.json" 