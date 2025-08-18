#!/bin/bash

# Catalog Golf - Local Development Startup Script
# This script ensures a clean, reliable local development environment

set -e  # Exit on any error

echo "🚀 Starting Catalog Golf Local Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -ti:$port > /dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill processes on a port
kill_port() {
    local port=$1
    if check_port $port; then
        print_warning "Port $port is in use, killing processes..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Function to cleanup on exit
cleanup() {
    print_status "Cleaning up processes..."
    jobs -p | xargs kill 2>/dev/null || true
    exit 0
}

# Trap cleanup on script exit
trap cleanup INT TERM EXIT

print_status "Checking PostgreSQL service..."
if ! brew services list | grep postgresql@15 | grep started > /dev/null; then
    print_warning "PostgreSQL not running, starting it..."
    brew services start postgresql@15
    sleep 3
fi

print_status "Cleaning up any conflicting processes..."
kill_port 3000  # Backend
kill_port 5173  # Frontend (primary)
kill_port 5174  # Frontend (alt)
kill_port 5175  # Frontend (alt)
kill_port 5176  # Frontend (alt)

# Kill any orphaned Node.js processes related to this project
pkill -f "node.*catalog" 2>/dev/null || true
pkill -f "npm.*dev" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "nodemon" 2>/dev/null || true

sleep 2

print_status "Setting up backend environment..."
cd backend

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    cat > .env << EOF
DATABASE_URL=postgres://postgres:postgres@localhost:5432/catalog_dev
EMAIL_QUEUE_URL=test-queue
AWS_REGION=us-east-1
JWT_SECRET=your-super-secret-jwt-key-for-local-development
NODE_ENV=development
EOF
    print_success "Backend .env file created"
fi

print_status "Ensuring database is up to date..."
npx sequelize-cli db:migrate > /dev/null 2>&1 || true
npx sequelize-cli db:seed:all > /dev/null 2>&1 || true

print_status "Starting backend server..."
npm start &
BACKEND_PID=$!

# Wait for backend to start
sleep 5

# Check if backend started successfully
if check_port 3000; then
    print_success "Backend started successfully on port 3000"
else
    print_error "Backend failed to start"
    exit 1
fi

print_status "Setting up frontend environment..."
cd ../frontend

# Create .env.local file if it doesn't exist
if [ ! -f .env.local ]; then
    echo "VITE_API_BASE_URL=http://localhost:3000/api/v1" > .env.local
    print_success "Frontend .env.local file created"
fi

print_status "Starting frontend server..."
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 5

# Find which port the frontend is using
FRONTEND_PORT=""
for port in 5173 5174 5175 5176; do
    if check_port $port; then
        FRONTEND_PORT=$port
        break
    fi
done

if [ -n "$FRONTEND_PORT" ]; then
    print_success "Frontend started successfully on port $FRONTEND_PORT"
    echo ""
    echo "🎉 Development environment is ready!"
    echo ""
    echo "📊 Backend:  http://localhost:3000"
    echo "🌐 Frontend: http://localhost:$FRONTEND_PORT"
    echo ""
    echo "🔐 Test Credentials:"
    echo "   Super Admin: super@catalog.golf / SuperPassword123!"
    echo "   Staff Admin: heber+hvr_11@catalog.golf / Password123!"
    echo ""
    echo "Press Ctrl+C to stop all services"
    echo ""
else
    print_error "Frontend failed to start"
    exit 1
fi

# Wait for user to stop
wait 