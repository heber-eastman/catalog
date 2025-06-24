# Frontend Deployment Guide

This guide explains how to deploy the Catalog Golf frontend to AWS.

## Prerequisites

1. **AWS CLI configured** with appropriate permissions
2. **Backend already deployed** using `deploy-aws-free-tier.sh`
3. **Node.js and npm** installed locally

## Deployment Options

### Option 1: Simple S3 Deployment (Recommended for Testing)

**Fastest deployment - Ready in 2-3 minutes**

```bash
./deploy-frontend-simple.sh
```

**What it does:**
- Builds the frontend for production
- Creates an S3 bucket for static hosting
- Uploads all frontend files
- Configures the frontend to connect to your backend API

**Result:** HTTP website accessible immediately

### Option 2: Full S3 + CloudFront Deployment (Production Ready)

**Complete deployment with CDN - Takes 15-20 minutes**

```bash
./deploy-frontend-aws.sh
```

**What it does:**
- Everything from Option 1, plus:
- Creates CloudFront distribution for global CDN
- Enables HTTPS encryption
- Optimizes caching and compression

**Result:** HTTPS website with global performance optimization

## Step-by-Step Process

### 1. Deploy Frontend

Choose your deployment option and run the script:

```bash
# For quick testing
./deploy-frontend-simple.sh

# OR for production with HTTPS
./deploy-frontend-aws.sh
```

### 2. Update Backend CORS (Important!)

After frontend deployment, update backend to allow the new domain:

```bash
./update-backend-cors.sh
```

This will:
- Find your deployed frontend URL
- Update backend CORS configuration
- Create a deployment script for the backend update

### 3. Deploy Backend Update

```bash
./deploy-backend-update.sh
```

This will:
- Upload the updated CORS configuration to your EC2 server
- Restart the backend service
- Test the connection

## What Gets Created

### AWS Resources (Simple Deployment)
- **S3 Bucket**: Static website hosting
- **Bucket Policy**: Public read access
- **Website Endpoint**: HTTP access URL

### AWS Resources (Full Deployment)
- Everything from simple deployment, plus:
- **CloudFront Distribution**: Global CDN
- **SSL Certificate**: Automatic HTTPS
- **Cache Behaviors**: Optimized performance

## Configuration Details

### Environment Variables
The deployment automatically creates `.env.production` with:
```
VITE_API_BASE_URL=http://YOUR_BACKEND_IP:3000/api/v1
VITE_APP_TITLE=Catalog Golf
VITE_APP_DESCRIPTION=Golf Course Management System
```

### CORS Configuration
Backend is updated to allow:
- `http://localhost:5173` (development)
- `http://localhost:3000` (local backend)
- `http://your-bucket.s3-website-us-east-1.amazonaws.com` (deployed frontend)

## Testing Your Deployment

### 1. Check Frontend Access
Visit the URL provided by the deployment script:
```
http://catalog-golf-frontend-XXXXXX.s3-website-us-east-1.amazonaws.com
```

### 2. Test API Connection
1. Open browser developer tools
2. Try logging in with your test credentials
3. Check network tab for successful API calls

### 3. Verify CORS
If you see CORS errors:
1. Ensure you ran `./update-backend-cors.sh`
2. Ensure you ran `./deploy-backend-update.sh`
3. Check backend logs on EC2 server

## Troubleshooting

### Frontend Not Loading
- Check S3 bucket policy is public
- Verify files were uploaded correctly
- Check browser console for errors

### API Calls Failing
- Verify backend is running: `http://YOUR_BACKEND_IP:3000/health`
- Check CORS configuration was updated
- Verify environment variables in build

### CORS Errors
```bash
# Re-run CORS update
./update-backend-cors.sh
./deploy-backend-update.sh

# Or manually SSH and restart backend
ssh -i catalog-golf-key.pem ec2-user@YOUR_BACKEND_IP
cd app/backend && npm start
```

## Cost Estimates

### Simple S3 Deployment
- **S3 Storage**: ~$0.50/month
- **S3 Requests**: ~$0.10/month
- **Total**: ~$0.60/month

### Full CloudFront Deployment
- **S3 Storage**: ~$0.50/month
- **CloudFront**: ~$1.00/month (1TB free tier)
- **Total**: ~$1.50/month

## Performance Benefits

### Simple Deployment
- ✅ Static file serving
- ✅ Instant availability
- ✅ Basic caching

### Full Deployment
- ✅ All simple benefits, plus:
- ✅ Global CDN (faster worldwide)
- ✅ HTTPS encryption
- ✅ Gzip compression
- ✅ Advanced caching rules

## Next Steps

1. **Custom Domain** (Optional): Configure Route 53 for custom domain
2. **SSL Certificate** (CloudFront only): Automatic with CloudFront
3. **Monitoring**: Set up CloudWatch for performance monitoring
4. **CI/CD**: Automate deployments with GitHub Actions

## Scripts Reference

- `deploy-frontend-simple.sh`: Quick S3-only deployment
- `deploy-frontend-aws.sh`: Full S3 + CloudFront deployment
- `update-backend-cors.sh`: Update backend CORS for frontend
- `deploy-backend-update.sh`: Deploy backend changes to EC2

## Support

If you encounter issues:
1. Check AWS CloudWatch logs
2. Verify all prerequisites are met
3. Ensure AWS CLI has proper permissions
4. Check the deployment script output for error messages 