#!/bin/bash

# AI Property Research Agent - Enterprise Setup Script
# This script sets up PostgreSQL + PostGIS, Redis, and Elasticsearch

set -e

echo "🚀 AI Property Research Agent - Enterprise Setup"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_status "Docker and Docker Compose are installed"
}

# Check if Node.js is installed
check_nodejs() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node -v)"
        exit 1
    fi
    
    print_status "Node.js $(node -v) is installed"
}

# Create necessary directories
create_directories() {
    print_info "Creating necessary directories..."
    
    mkdir -p database/init
    mkdir -p data/sessions
    mkdir -p reports
    mkdir -p logs
    
    print_status "Directories created"
}

# Install Node.js dependencies
install_dependencies() {
    print_info "Installing Node.js dependencies..."
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Make sure you're in the project root directory."
        exit 1
    fi
    
    npm install
    print_status "Node.js dependencies installed"
}

# Start infrastructure services
start_infrastructure() {
    print_info "Starting infrastructure services (PostgreSQL, Redis, Elasticsearch)..."
    
    # Stop any existing services
    docker-compose down -v 2>/dev/null || true
    
    # Start infrastructure services
    docker-compose up -d postgres redis elasticsearch
    
    print_info "Waiting for services to be ready..."
    
    # Wait for PostgreSQL
    echo -n "Waiting for PostgreSQL"
    until docker exec propertylist_postgres pg_isready -U propertylist -d propertylist_db &>/dev/null; do
        echo -n "."
        sleep 2
    done
    echo ""
    print_status "PostgreSQL is ready"
    
    # Wait for Redis
    echo -n "Waiting for Redis"
    until docker exec propertylist_redis redis-cli ping &>/dev/null; do
        echo -n "."
        sleep 2
    done
    echo ""
    print_status "Redis is ready"
    
    # Wait for Elasticsearch
    echo -n "Waiting for Elasticsearch"
    until curl -s http://localhost:9200/_cluster/health &>/dev/null; do
        echo -n "."
        sleep 5
    done
    echo ""
    print_status "Elasticsearch is ready"
}

# Initialize database schema
initialize_database() {
    print_info "Initializing database schema..."
    
    # Copy environment file
    if [ ! -f ".env.local" ]; then
        if [ -f "config/enterprise.env.example" ]; then
            cp config/enterprise.env.example .env.local
            print_status "Created .env.local from example"
        else
            print_warning "No .env.local found. Please create one with your configuration."
        fi
    fi
    
    # Run database initialization
    node -e "
        require('dotenv').config({ path: '.env.local' });
        const PostgresDatabase = require('./server/database/postgresDatabase');
        const db = new PostgresDatabase();
        db.init().then(() => {
            console.log('✅ Database schema initialized');
            process.exit(0);
        }).catch(err => {
            console.error('❌ Database initialization failed:', err.message);
            process.exit(1);
        });
    "
}

# Test the system
test_system() {
    print_info "Testing system components..."
    
    # Test PostgreSQL connection
    if docker exec propertylist_postgres psql -U propertylist -d propertylist_db -c "SELECT version();" &>/dev/null; then
        print_status "PostgreSQL connection test passed"
    else
        print_error "PostgreSQL connection test failed"
        exit 1
    fi
    
    # Test Redis connection
    if docker exec propertylist_redis redis-cli ping | grep -q "PONG"; then
        print_status "Redis connection test passed"
    else
        print_error "Redis connection test failed"
        exit 1
    fi
    
    # Test Elasticsearch connection
    if curl -s http://localhost:9200/_cluster/health | grep -q "cluster_name"; then
        print_status "Elasticsearch connection test passed"
    else
        print_error "Elasticsearch connection test failed"
        exit 1
    fi
}

# Show service information
show_service_info() {
    echo ""
    echo "🎉 Enterprise setup completed successfully!"
    echo "=========================================="
    echo ""
    echo "📊 Service Information:"
    echo "----------------------"
    echo "PostgreSQL + PostGIS: localhost:5432"
    echo "  Database: propertylist_db"
    echo "  Username: propertylist"
    echo "  Password: secure_password"
    echo ""
    echo "Redis Cache: localhost:6379"
    echo "  No authentication required"
    echo ""
    echo "Elasticsearch: http://localhost:9200"
    echo "  No authentication required"
    echo ""
    echo "🔧 Management Commands:"
    echo "----------------------"
    echo "Start services:     docker-compose up -d"
    echo "Stop services:      docker-compose down"
    echo "View logs:          docker-compose logs -f"
    echo "Reset data:         docker-compose down -v"
    echo ""
    echo "🚀 Next Steps:"
    echo "--------------"
    echo "1. Update .env.local with your API keys"
    echo "2. Start the application: npm run dev"
    echo "3. Import XML feed: curl -X POST http://localhost:3004/api/admin/feed/update"
    echo ""
    echo "📈 Monitoring:"
    echo "--------------"
    echo "Health check:       curl http://localhost:3004/api/health"
    echo "Database stats:     curl http://localhost:3004/api/admin/feed/status"
    echo "Cache stats:        Check Redis at http://localhost:6379"
    echo ""
}

# Main execution
main() {
    echo ""
    print_info "Starting enterprise setup process..."
    echo ""
    
    check_docker
    check_nodejs
    create_directories
    install_dependencies
    start_infrastructure
    initialize_database
    test_system
    show_service_info
    
    print_status "Setup completed successfully! 🎉"
}

# Handle script interruption
trap 'print_error "Setup interrupted. Run docker-compose down to clean up."; exit 1' INT

# Run main function
main 