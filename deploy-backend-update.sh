#!/bin/bash
echo "🚀 Deploying backend CORS update to AWS..."

# Upload updated files to EC2
scp -i catalog-golf-key.pem -o StrictHostKeyChecking=no backend/src/app.js ec2-user@54.226.247.248:/home/ec2-user/app/backend/src/

# Restart the backend service
ssh -i catalog-golf-key.pem -o StrictHostKeyChecking=no ec2-user@54.226.247.248 << 'REMOTE_EOF'
cd /home/ec2-user/app
# Set environment variable
export FRONTEND_URL="http://catalog-golf-frontend-1750797391	catalog-golf-frontend-simple-1750793998.s3-website-us-east-1.amazonaws.com"
echo "FRONTEND_URL=http://catalog-golf-frontend-1750797391	catalog-golf-frontend-simple-1750793998.s3-website-us-east-1.amazonaws.com" >> backend/.env

# Restart the backend (assuming it's running with pm2 or similar)
pkill -f "node src/index.js" || true
sleep 2
cd backend && nohup npm start > ../backend.log 2>&1 &

echo "Backend updated and restarted"
REMOTE_EOF

echo "✅ Backend CORS update deployed successfully"
