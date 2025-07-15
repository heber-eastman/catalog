#!/bin/bash

echo "💾 Setting up scheduled RDS start/stop for cost optimization..."

# Variables
DB_INSTANCE="catalog-golf-db"

# Create IAM role for RDS stop/start
echo "🔑 Creating IAM role for RDS scheduling..."
aws iam create-role \
    --role-name RDS-ScheduledScaling-Role \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "Service": "events.amazonaws.com"
                },
                "Action": "sts:AssumeRole"
            }
        ]
    }' 2>/dev/null || echo "⚠️ Role may already exist"

# Create Lambda function to stop/start RDS
echo "⚡ Creating Lambda function for RDS control..."
mkdir -p /tmp/rds-lambda
cat > /tmp/rds-lambda/index.js << 'EOF'
const AWS = require('aws-sdk');
const rds = new AWS.RDS();

exports.handler = async (event) => {
    const action = event.action; // 'stop' or 'start'
    const dbInstanceIdentifier = event.dbInstanceIdentifier;
    
    try {
        if (action === 'stop') {
            await rds.stopDBInstance({
                DBInstanceIdentifier: dbInstanceIdentifier
            }).promise();
            console.log(`Stopped RDS instance: ${dbInstanceIdentifier}`);
        } else if (action === 'start') {
            await rds.startDBInstance({
                DBInstanceIdentifier: dbInstanceIdentifier
            }).promise();
            console.log(`Started RDS instance: ${dbInstanceIdentifier}`);
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify(`${action} completed for ${dbInstanceIdentifier}`)
        };
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
};
EOF

# Create deployment package
cd /tmp/rds-lambda
zip -r rds-scheduler.zip .

# Create Lambda function
aws lambda create-function \
    --function-name rds-scheduler \
    --runtime nodejs18.x \
    --role arn:aws:iam::722895251763:role/lambda-execution-role \
    --handler index.handler \
    --zip-file fileb://rds-scheduler.zip \
    --description "Lambda function to start/stop RDS instances on schedule" \
    2>/dev/null || aws lambda update-function-code \
    --function-name rds-scheduler \
    --zip-file fileb://rds-scheduler.zip

# Get Lambda function ARN
LAMBDA_ARN=$(aws lambda get-function --function-name rds-scheduler --query 'Configuration.FunctionArn' --output text)

echo "📅 Creating scheduled RDS stop/start rules..."

# Stop RDS at 11 PM UTC (6 PM EST)
aws events put-rule \
    --name rds-stop-nightly \
    --schedule-expression "cron(0 23 * * ? *)" \
    --description "Stop RDS instance at night to save costs"

# Start RDS at 6 AM UTC (1 AM EST)  
aws events put-rule \
    --name rds-start-morning \
    --schedule-expression "cron(0 6 * * ? *)" \
    --description "Start RDS instance in the morning"

# Add Lambda permission for CloudWatch Events
aws lambda add-permission \
    --function-name rds-scheduler \
    --statement-id allow-cloudwatch-stop \
    --action lambda:InvokeFunction \
    --principal events.amazonaws.com \
    --source-arn arn:aws:events:us-east-1:722895251763:rule/rds-stop-nightly

aws lambda add-permission \
    --function-name rds-scheduler \
    --statement-id allow-cloudwatch-start \
    --action lambda:InvokeFunction \
    --principal events.amazonaws.com \
    --source-arn arn:aws:events:us-east-1:722895251763:rule/rds-start-morning

# Add targets to stop RDS
aws events put-targets \
    --rule rds-stop-nightly \
    --targets "Id"="1","Arn"="${LAMBDA_ARN}","Input"="{\"action\":\"stop\",\"dbInstanceIdentifier\":\"${DB_INSTANCE}\"}"

# Add targets to start RDS
aws events put-targets \
    --rule rds-start-morning \
    --targets "Id"="1","Arn"="${LAMBDA_ARN}","Input"="{\"action\":\"start\",\"dbInstanceIdentifier\":\"${DB_INSTANCE}\"}"

# Cleanup
rm -rf /tmp/rds-lambda

echo ""
echo "✅ RDS scheduled start/stop setup complete!"
echo ""
echo "📅 Schedule:"
echo "   • RDS STOP: Daily at 11 PM UTC (6 PM EST)"
echo "   • RDS START: Daily at 6 AM UTC (1 AM EST)"
echo ""
echo "💰 Expected RDS savings: ~17 hours/day = ~510 hours/month"
echo ""
echo "⚠️ Important notes:"
echo "   • RDS takes 5-10 minutes to start up"
echo "   • Your website will be unavailable when RDS is stopped"
echo "   • Consider keeping RDS running if you need 24/7 availability" 