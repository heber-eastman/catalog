#!/bin/bash

# Start Localstack for E2E testing
echo "🚀 Starting Localstack for E2E testing..."

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install docker-compose first."
    exit 1
fi

# Start Localstack service
echo "📦 Starting Localstack container..."
docker-compose up -d localstack

# Wait for Localstack to be ready
echo "⏳ Waiting for Localstack to be ready..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if curl -s http://localhost:4566/_localstack/health > /dev/null 2>&1; then
        echo "✅ Localstack is ready!"
        break
    fi
    
    echo "Attempt $attempt/$max_attempts - Localstack not ready yet..."
    sleep 2
    ((attempt++))
done

if [ $attempt -gt $max_attempts ]; then
    echo "❌ Localstack failed to start within the timeout period"
    docker-compose logs localstack
    exit 1
fi

echo "🎉 Localstack is running and ready for E2E tests!"
echo "📍 Localstack endpoint: http://localhost:4566"
echo "🔧 To run E2E tests: npm run test:e2e"
echo "🛑 To stop Localstack: docker-compose down localstack" 