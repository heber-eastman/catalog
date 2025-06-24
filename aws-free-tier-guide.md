# AWS Free Tier Deployment Guide

## 🆓 What You Get for Free

AWS Free Tier includes (12 months for new accounts):
- **EC2**: 750 hours/month of t2.micro instances
- **RDS**: 750 hours/month of db.t3.micro + 20GB storage  
- **S3**: 5GB storage + 20,000 GET requests + 2,000 PUT requests
- **CloudWatch**: 10 custom metrics + 5GB log ingestion
- **Data Transfer**: 15GB outbound per month

## 🚀 Quick Setup

### Prerequisites
1. AWS Account (new accounts get 12 months free tier)
2. AWS CLI installed and configured
3. Your application code ready

### Step 1: Deploy Infrastructure
```bash
# Make the script executable
chmod +x deploy-aws-free-tier.sh

# Run the deployment
./deploy-aws-free-tier.sh
```

This will create:
- VPC with public/private subnets
- EC2 t2.micro instance (FREE)
- RDS db.t3.micro PostgreSQL (FREE)
- Security groups and networking

### Step 2: Connect to Your Server
```bash
# SSH into your EC2 instance
ssh -i catalog-golf-key.pem ec2-user@<PUBLIC_IP>
```

### Step 3: Deploy Your Application
```bash
# On the EC2 instance:

# 1. Clone your repository
git clone https://github.com/your-username/your-repo.git
cd your-repo

# 2. Set up environment variables
cat > .env << EOF
NODE_ENV=production
PORT=3000
DB_HOST=<RDS_ENDPOINT>
DB_PORT=5432
DB_NAME=catalog_golf
DB_USERNAME=catalogadmin
DB_PASSWORD=CatalogDB2025!
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
EOF

# 3. Install dependencies
cd backend && npm install
cd ../frontend && npm install && npm run build

# 4. Run database migrations
cd ../backend
npm run migrate

# 5. Start the application
npm start
```

## 🔧 Production Setup Script

Create this script on your EC2 instance:

```bash
#!/bin/bash
# save as setup-production.sh

set -e

echo "🚀 Setting up Catalog Golf in Production"

# Install PM2 for process management
npm install -g pm2

# Create production environment file
cat > /home/ec2-user/app/.env << EOF
NODE_ENV=production
PORT=3000
DB_HOST=$1  # Pass RDS endpoint as first argument
DB_PORT=5432
DB_NAME=catalog_golf
DB_USERNAME=catalogadmin
DB_PASSWORD=CatalogDB2025!
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
CORS_ORIGIN=http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
EOF

# Build frontend
cd /home/ec2-user/app/frontend
npm run build

# Set up nginx to serve frontend
sudo amazon-linux-extras install nginx1 -y
sudo systemctl start nginx
sudo systemctl enable nginx

# Configure nginx
sudo tee /etc/nginx/conf.d/catalog-golf.conf << EOF
server {
    listen 80;
    server_name _;
    
    # Serve frontend
    location / {
        root /home/ec2-user/app/frontend/dist;
        try_files \$uri \$uri/ /index.html;
    }
    
    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:3000;
    }
}
EOF

sudo nginx -t
sudo systemctl reload nginx

# Start backend with PM2
cd /home/ec2-user/app/backend
pm2 start src/index.js --name "catalog-golf-api"
pm2 startup
pm2 save

echo "✅ Setup complete! Your app is running at http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
```

## 💰 Free Tier Limits & Monitoring

### Monthly Limits (Free Tier)
- **EC2**: 750 hours (= 1 t2.micro running 24/7)
- **RDS**: 750 hours (= 1 db.t3.micro running 24/7)
- **Storage**: 20GB EBS + 20GB RDS
- **Data Transfer**: 15GB outbound

### Cost After Free Tier
- EC2 t2.micro: ~$8.50/month
- RDS db.t3.micro: ~$12.60/month
- **Total**: ~$21/month

### Set Up Billing Alerts
1. Go to AWS Console → Billing
2. Set up billing alerts for $10, $20, $30
3. Monitor usage in CloudWatch

## 🔒 Security Best Practices

### 1. Secure SSH Access
```bash
# Limit SSH to your IP only
aws ec2 authorize-security-group-ingress \
    --group-id sg-xxxxxxxxx \
    --protocol tcp \
    --port 22 \
    --cidr YOUR_IP/32
```

### 2. Database Security
- RDS is in private subnet (not publicly accessible)
- Only EC2 security group can access database
- Strong password set

### 3. Application Security
- Environment variables secured
- CORS properly configured
- Rate limiting enabled

## 📊 Monitoring & Maintenance

### Check Application Health
```bash
# SSH into server
ssh -i catalog-golf-key.pem ec2-user@<PUBLIC_IP>

# Check PM2 status
pm2 status

# View logs
pm2 logs catalog-golf-api

# Restart if needed
pm2 restart catalog-golf-api
```

### Database Maintenance
```bash
# Connect to database
psql -h <RDS_ENDPOINT> -U catalogadmin -d catalog_golf

# Check database size
\l+

# Backup database
pg_dump -h <RDS_ENDPOINT> -U catalogadmin catalog_golf > backup.sql
```

## 🚨 Troubleshooting

### Application Won't Start
```bash
# Check logs
pm2 logs

# Check environment variables
cat .env

# Test database connection
node -e "require('./src/models/index.js')"
```

### High Memory Usage
```bash
# Check memory
free -h

# Restart application
pm2 restart catalog-golf-api

# Monitor with htop
sudo yum install htop -y && htop
```

### Database Connection Issues
```bash
# Test connection from EC2
telnet <RDS_ENDPOINT> 5432

# Check security groups
aws ec2 describe-security-groups --group-ids <RDS_SG_ID>
```

## 📈 Scaling Options

### When You Outgrow Free Tier:
1. **Upgrade EC2**: t2.micro → t2.small → t2.medium
2. **Add Load Balancer**: Application Load Balancer for multiple instances
3. **Database Scaling**: Read replicas, larger instance sizes
4. **CDN**: CloudFront for static assets
5. **Auto Scaling**: ASG for handling traffic spikes

### Migration Path:
```bash
# Create AMI of your configured instance
aws ec2 create-image --instance-id <INSTANCE_ID> --name "catalog-golf-v1"

# Launch from AMI when scaling
aws ec2 run-instances --image-id <AMI_ID> --instance-type t2.small
```

This setup gives you a production-ready application on AWS completely free for the first 12 months! 