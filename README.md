# Catalog V0 - Golf Course Management Platform

A modern full-stack golf course management application built with Express.js, Vue 3, and Vuetify, featuring comprehensive CI/CD setup, testing infrastructure, and production-ready AWS deployment.

## 🏗️ Architecture

This monorepo consists of two main workspaces:

- **Backend**: Express.js API server with Sequelize ORM and PostgreSQL
- **Frontend**: Vue 3 application with Vuetify UI framework
- **Infrastructure**: AWS-based deployment with ECS, RDS, and CloudFront

## 📦 Tech Stack

### Backend

- **Express.js** - Web framework
- **Sequelize** - ORM for PostgreSQL
- **PostgreSQL** - Database
- **JWT** - Authentication
- **AWS SDK** - Cloud services integration (SES, S3, CloudWatch)
- **Joi** - Schema validation
- **bcrypt** - Password hashing
- **Docker** - Containerization

### Frontend

- **Vue 3** - Progressive JavaScript framework
- **Vuetify 3** - Material Design component library
- **Vite** - Build tool and dev server
- **Vue Router** - Client-side routing
- **Pinia** - State management
- **Axios** - HTTP client

### DevOps & Infrastructure

- **Docker** - Containerization
- **AWS ECS** - Container orchestration
- **AWS ECR** - Container registry
- **AWS RDS** - Managed PostgreSQL
- **AWS SES** - Email service
- **AWS CloudWatch** - Monitoring and logging
- **GitHub Actions** - CI/CD pipeline
- **Cypress** - End-to-end testing

### Development Tools

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Jest/Vitest** - Testing frameworks
- **Cypress** - E2E testing
- **GitHub Actions** - CI/CD pipeline

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm (comes with Node.js)
- PostgreSQL (for local development)
- Docker (for deployment)
- AWS CLI (for deployment)

### Local Development Setup

1. **Clone the repository:**

```bash
git clone <your-repo-url>
cd catalog-v0
```

2. **Install dependencies:**

```bash
npm install
```

3. **Set up environment variables:**

```bash
# Backend environment
cp backend/env.example backend/.env
```

Edit `backend/.env` with your configuration:

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/catalog_dev
DB_HOST=localhost
DB_PORT=5432
DB_NAME=catalog_dev
DB_USER=your_username
DB_PASSWORD=your_password

# Security
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters
SESSION_SECRET=your-session-secret

# Email Configuration (Development)
EMAIL_FROM=noreply@catalog.golf
AWS_REGION=us-east-1
# For production, set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Environment
NODE_ENV=development
PORT=3000
```

4. **Set up the database:**

```bash
# Create database
createdb catalog_dev

# Run migrations
cd backend
npm run db:migrate

# (Optional) Seed with sample data
npm run db:seed
```

5. **Start development servers:**

```bash
# Start backend (runs on http://localhost:3000)
npm run dev:backend

# In another terminal, start frontend (runs on http://localhost:5173)
npm run dev:frontend
```

## 📋 Available Scripts

### Root Level

- `npm run install:all` - Install all dependencies
- `npm run lint` - Run ESLint on all workspaces
- `npm run lint:fix` - Fix linting issues automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm test` - Run tests in all workspaces
- `npm run test:e2e` - Run Cypress end-to-end tests
- `npm run dev:backend` - Start backend development server
- `npm run dev:frontend` - Start frontend development server
- `npm run build:backend` - Build backend for production
- `npm run build:frontend` - Build frontend for production
- `npm run docker:build` - Build Docker images
- `npm run docker:up` - Start Docker containers
- `npm run deploy:staging` - Deploy to staging environment
- `npm run deploy:production` - Deploy to production environment

### Backend

- `npm run dev --workspace=backend` - Start development server
- `npm run test --workspace=backend` - Run backend tests
- `npm run test:watch --workspace=backend` - Run tests in watch mode
- `npm run db:migrate --workspace=backend` - Run database migrations
- `npm run db:seed --workspace=backend` - Seed database with sample data
- `npm run db:reset --workspace=backend` - Reset database (drop, create, migrate, seed)

### Frontend

- `npm run dev --workspace=frontend` - Start development server
- `npm run build --workspace=frontend` - Build for production
- `npm run preview --workspace=frontend` - Preview production build
- `npm run test --workspace=frontend` - Run frontend tests

## 🧪 Testing

The project includes comprehensive testing setup:

- **Jest** for backend testing with Supertest for API testing
- **Vitest** for frontend testing with Vue Test Utils
- **Cypress** for end-to-end testing
- **Smoke tests** for staging/production verification

### Running Tests

```bash
# Run all unit tests
npm test

# Run backend tests only
npm run test --workspace=backend

# Run frontend tests only
npm run test --workspace=frontend

# Run end-to-end tests
npm run test:e2e

# Run smoke tests
npm run test:smoke
```

### Test Coverage

- Unit tests cover business logic and API endpoints
- Integration tests verify database operations
- E2E tests cover complete user workflows
- Smoke tests verify production deployments

## 🔧 Database Management

### Migrations

```bash
# Run pending migrations
npm run db:migrate --workspace=backend

# Create a new migration
npm run db:migrate:create --workspace=backend -- --name your-migration-name

# Rollback last migration
npm run db:migrate:undo --workspace=backend
```

### Seeding

```bash
# Run all seeders
npm run db:seed --workspace=backend

# Run specific seeder
npm run db:seed --workspace=backend -- --seed 20240101000000-demo-users.js
```

### Database Reset

```bash
# Complete database reset (development only)
npm run db:reset --workspace=backend
```

## 🐳 Docker Setup

### Development with Docker

```bash
# Build images
npm run docker:build

# Start all services
npm run docker:up

# Stop all services
npm run docker:down

# View logs
docker-compose logs -f
```

### Docker Configuration

The project includes optimized Dockerfiles for production:

- **Backend**: Multi-stage build with Node.js Alpine
- **Frontend**: Nginx-based static file serving
- **Database**: PostgreSQL with custom initialization

## ☁️ AWS Deployment

### Prerequisites

1. **AWS Account Setup:**

   - AWS CLI installed and configured
   - Appropriate IAM permissions
   - Domain registered (catalog.golf)

2. **Required AWS Services:**
   - ECS (Elastic Container Service)
   - ECR (Elastic Container Registry)
   - RDS (PostgreSQL)
   - SES (Simple Email Service)
   - CloudWatch (Monitoring)
   - Route 53 (DNS)
   - Certificate Manager (SSL)

### Environment Variables for Production

Create environment-specific configuration:

```bash
# Production Backend Environment
DATABASE_URL=postgresql://catalog_user:secure_password@catalog-prod.amazonaws.com:5432/catalog_prod
JWT_SECRET=production-super-secret-jwt-key-64-characters-minimum
SESSION_SECRET=production-session-secret

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-production-access-key
AWS_SECRET_ACCESS_KEY=your-production-secret-key

# Email Configuration
EMAIL_FROM=noreply@catalog.golf
SES_REGION=us-east-1

# Environment
NODE_ENV=production
PORT=3000

# Rate Limiting (Production)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

### Deployment Steps

1. **Initial Infrastructure Setup:**

```bash
# Run the AWS setup script
./deploy-aws-setup.sh
```

2. **Build and Push Docker Images:**

```bash
# Build production images
npm run docker:build:prod

# Push to ECR
npm run docker:push
```

3. **Deploy Application:**

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production (after staging verification)
npm run deploy:production
```

4. **Database Setup:**

```bash
# Run production migrations
npm run db:migrate:prod

# Verify deployment
npm run test:smoke:prod
```

### Deployment Verification

After deployment, verify:

- ✅ Application loads at https://your-domain.catalog.golf
- ✅ SSL certificate is valid
- ✅ Database connections are working
- ✅ Email sending through SES works
- ✅ CloudWatch logs are being generated
- ✅ All smoke tests pass

## 🔐 Security

### Environment Security

- All secrets stored in AWS Secrets Manager
- JWT tokens with short expiration times
- Rate limiting enabled on all endpoints
- CORS configured for production domains
- Helmet.js security headers
- Input validation on all endpoints

### Database Security

- Encrypted RDS instances
- Database credentials in Secrets Manager
- Connection pooling with timeouts
- Prepared statements (SQL injection protection)

## 📊 Monitoring & Logging

### CloudWatch Integration

- Application logs
- Error tracking
- Performance metrics
- Custom alarms for critical issues

### Health Checks

- Application health endpoint: `/health`
- Database health endpoint: `/health/db`
- External service health checks

## 🚢 CI/CD Pipeline

The GitHub Actions workflow automatically:

1. **On Pull Request:**

   - Runs linting and formatting checks
   - Executes all unit tests
   - Builds Docker images
   - Runs security audits

2. **On Merge to Main:**

   - Builds and pushes Docker images to ECR
   - Deploys to staging environment
   - Runs smoke tests
   - Deploys to production (manual approval)

3. **Production Deployment:**
   - Blue-green deployment strategy
   - Database migration execution
   - Health check verification
   - Rollback capability

## 🧪 End-to-End Testing

### Cypress Tests

Complete user workflows covered:

- Super admin login and course management
- Staff registration and customer management
- Customer CRUD operations
- Multi-tenant isolation
- Email confirmation flows

### Running E2E Tests

```bash
# Run headless
npm run test:e2e

# Run with UI
npm run test:e2e:open

# Run against staging
npm run test:e2e:staging
```

## 📈 Performance

### Optimization Features

- Vue 3 with Vite for fast builds
- Frontend code splitting
- Image optimization
- Gzip compression
- CDN distribution via CloudFront
- Database query optimization
- Connection pooling

### Monitoring

- Response time tracking
- Error rate monitoring
- Resource utilization alerts
- User experience metrics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and ensure tests pass: `npm test`
4. Run linting: `npm run lint:fix`
5. Test locally: `npm run test:e2e`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Development Guidelines

- Write tests for new features
- Follow the existing code style
- Update documentation as needed
- Ensure all CI checks pass
- Test on staging before production

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Troubleshooting

### Common Issues

**Database Connection Issues:**

```bash
# Check PostgreSQL is running
pg_isready

# Reset database
npm run db:reset --workspace=backend
```

**Docker Issues:**

```bash
# Clean Docker cache
docker system prune -a

# Rebuild containers
npm run docker:build --no-cache
```

**AWS Deployment Issues:**

```bash
# Check ECS service status
aws ecs describe-services --cluster catalog-golf --services catalog-golf-backend

# Check CloudWatch logs
aws logs tail /ecs/catalog-golf --follow
```

---

Built with ❤️ for the golf course management community
