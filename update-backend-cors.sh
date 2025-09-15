#!/bin/bash

# Update Backend CORS Configuration for Deployed Frontend
# This script updates the backend CORS settings to allow the deployed frontend domain

set -e

echo "🔧 Updating Backend CORS Configuration"
echo "===================================="

# Configuration variables
APP_NAME="catalog-golf"

# Get the frontend S3 bucket URL if it exists
echo "📋 Looking for deployed frontend..."

# Try to find the most recent frontend bucket
FRONTEND_BUCKET=$(aws s3api list-buckets \
    --query "Buckets[?contains(Name, '$APP_NAME-frontend')].Name" \
    --output text | tail -1 2>/dev/null || echo "")

if [ -z "$FRONTEND_BUCKET" ]; then
    echo "❌ No deployed frontend found. Please deploy frontend first."
    exit 1
fi

FRONTEND_URL="http://$FRONTEND_BUCKET.s3-website-us-east-1.amazonaws.com"
echo "✅ Found frontend at: $FRONTEND_URL"

# Get backend server info
BACKEND_INSTANCE_ID=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=$APP_NAME-server" "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text 2>/dev/null || echo "none")

if [ "$BACKEND_INSTANCE_ID" = "none" ]; then
    echo "❌ Backend server not found."
    exit 1
fi

BACKEND_IP=$(aws ec2 describe-instances \
    --instance-ids $BACKEND_INSTANCE_ID \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

echo "✅ Backend server found: $BACKEND_IP"

# Create updated app.js with new CORS configuration
echo "🔨 Creating updated CORS configuration..."

cat > backend-cors-update.js << 'EOF'
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const signupRouter = require('./routes/signup');
const confirmRouter = require('./routes/confirm');
const customersRouter = require('./routes/customers');
const notesRouter = require('./routes/notes');
const staffRouter = require('./routes/staff');
const superAdminsRouter = require('./routes/super-admins');
const authRouter = require('./routes/auth');
const healthRouter = require('./routes/health');
const {
  rateLimitMiddleware,
  strictRateLimitMiddleware,
} = require('./middleware/rateLimit');
const { extractSubdomainOptional } = require('./middleware/subdomain');

const app = express();

// CORS configuration - Updated for deployed frontend
const allowedOrigins = [
  'http://localhost:5173', 
  'http://localhost:3000',
  process.env.FRONTEND_URL || 'FRONTEND_URL_PLACEHOLDER'
];

// Filter out empty origins
const validOrigins = allowedOrigins.filter(origin => origin && !origin.includes('PLACEHOLDER'));

app.use(
  cors({
    origin: validOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  })
);

app.use(morgan('combined'));
app.use(express.json());
app.use(cookieParser());

// Add rate limiting middleware
app.use(rateLimitMiddleware);

// Add subdomain extraction for optional use
app.use(extractSubdomainOptional);

// Health check endpoints (no rate limiting)
app.use('/health', healthRouter);
app.use('/api/v1/health', healthRouter);

// Basic root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Backend API is running!',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1', strictRateLimitMiddleware, signupRouter); // Stricter rate limiting for signup
app.use('/api/v1', confirmRouter);
app.use('/api/v1', customersRouter);
app.use('/api/v1', notesRouter);
app.use('/api/v1/staff', staffRouter);
app.use('/api/v1/super-admin', superAdminsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
EOF

# Replace the placeholder with the actual frontend URL
sed "s|FRONTEND_URL_PLACEHOLDER|$FRONTEND_URL|g" backend-cors-update.js > backend/src/app.js

echo "✅ Updated app.js with new CORS configuration"

# Create deployment script for backend update
cat > deploy-backend-update.sh << EOF
#!/bin/bash
echo "🚀 Deploying backend CORS update to AWS..."

# Upload updated files to EC2
scp -i $APP_NAME-key.pem -o StrictHostKeyChecking=no backend/src/app.js ec2-user@$BACKEND_IP:/home/ec2-user/app/backend/src/

# Restart the backend service
ssh -i $APP_NAME-key.pem -o StrictHostKeyChecking=no ec2-user@$BACKEND_IP << 'REMOTE_EOF'
cd /home/ec2-user/app
# Set environment variable
export FRONTEND_URL="$FRONTEND_URL"
echo "FRONTEND_URL=$FRONTEND_URL" >> backend/.env

# Restart the backend (assuming it's running with pm2 or similar)
pkill -f "node src/index.js" || true
sleep 2
cd backend && nohup npm start > ../backend.log 2>&1 &

echo "Backend updated and restarted"
REMOTE_EOF

echo "✅ Backend CORS update deployed successfully"
EOF

chmod +x deploy-backend-update.sh

# Clean up temporary file
rm backend-cors-update.js

echo ""
echo "🎉 CORS CONFIGURATION UPDATED!"
echo "============================="
echo ""
echo "📋 Updated Configuration:"
echo "  • Added frontend URL: $FRONTEND_URL"
echo "  • Kept localhost URLs for development"
echo ""
echo "📝 Next Steps:"
echo "  1. Deploy the update to AWS: ./deploy-backend-update.sh"
echo "  2. Test CORS by accessing: $FRONTEND_URL"
echo ""
echo "🔧 Manual Alternative:"
echo "  SSH into server: ssh -i $APP_NAME-key.pem ec2-user@$BACKEND_IP"
echo "  Set environment: export FRONTEND_URL=\"$FRONTEND_URL\""
echo "  Restart backend: cd app/backend && npm start"
EOF 