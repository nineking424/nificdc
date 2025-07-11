# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NiFiCDC is a web-based Change Data Capture (CDC) service that provides a user-friendly interface for Apache NiFi. The project is currently in the infrastructure setup phase with Docker services configured but no application code implemented yet.

## Development Commands

### Environment Setup
```bash
# Copy and configure environment variables
cp .env.example .env

# Start all services
docker-compose up -d

# View service logs
docker-compose logs -f [service-name]

# Stop services
docker-compose down
```

### Service Access
- **NiFi UI**: https://localhost:8443/nifi (admin/adminpassword123)
- **pgAdmin**: http://localhost:5050 (admin@nificdc.local/pgadminpassword123)
- **Redis**: localhost:6379 (password: redispassword123)
- **PostgreSQL**: localhost:5432 (nificdc_user/postgrespassword123, database: nificdc)

## Git Workflow

### Automatic Commit and Push Guidelines

Claude should automatically commit and push changes after completing each small development unit:

1. **When to Commit**:
   - After implementing a new feature or component
   - After fixing a bug
   - After creating or updating configuration files
   - After adding new dependencies
   - After updating documentation
   - After completing any logical unit of work

2. **Commit Process**:
   ```bash
   # Stage all changes
   git add .
   
   # Create descriptive commit message
   git commit -m "type: brief description"
   
   # Push to remote repository
   git push origin main
   ```

3. **Commit Message Format**:
   - `feat:` New feature implementation
   - `fix:` Bug fix
   - `docs:` Documentation updates
   - `style:` Code formatting, no functional changes
   - `refactor:` Code restructuring without changing functionality
   - `test:` Adding or updating tests
   - `chore:` Build process or auxiliary tool changes
   - `config:` Configuration file changes

4. **Examples**:
   ```bash
   git commit -m "feat: Add docker-compose configuration for NiFi, Redis, and PostgreSQL"
   git commit -m "docs: Update CLAUDE.md with git workflow guidelines"
   git commit -m "config: Add environment variable template file"
   ```

5. **Best Practices**:
   - Keep commits small and focused
   - Never commit sensitive information (passwords, API keys)
   - Always test changes before committing
   - Write clear, descriptive commit messages
   - Push immediately after committing to maintain sync

## Architecture

### Service Architecture
- **Apache NiFi**: External CDC engine accessed via REST API
- **Redis**: Caching layer for performance optimization
- **PostgreSQL**: Metadata storage for systems, mappings, jobs
- **pgAdmin**: Database administration interface

### Planned Application Architecture (from PRD)
- **Frontend**: Vue.js SPA with modern UI framework
- **Backend**: RESTful API (technology not yet chosen: Node.js/Python/Java)
- **Authentication**: JWT-based with role management
- **Data Flow**: Frontend → Backend API → NiFi API / PostgreSQL / Redis

## Key Implementation Requirements

### Backend API Endpoints (to be implemented)
- System management CRUD operations
- Data source/target definition management
- Mapping configuration management
- Job scheduling and monitoring
- Real-time status and metrics
- User authentication and authorization

### Frontend Components (to be implemented)
- Dashboard with real-time monitoring
- System/Data/Mapping/Job management interfaces
- Visual mapping editor
- Job scheduler interface
- User management interface

### Database Schema (to be designed)
- Systems (source/target configurations)
- Data definitions (tables, files, APIs)
- Mappings (field-level transformations)
- Jobs (schedules, status, history)
- Users and permissions

## NiFi Integration Guidelines

When implementing NiFi API integration:
- Use NiFi REST API for processor management
- Implement proper error handling for NiFi connection issues
- Cache NiFi processor status in Redis for performance
- Store NiFi processor IDs and metadata in PostgreSQL

## Performance Requirements
- Support 100+ concurrent users
- Page load time < 3 seconds
- API response time < 1 second
- Implement pagination for large datasets
- Use Redis caching strategically

## Security Considerations
- Implement JWT authentication
- Encrypt sensitive data in PostgreSQL
- Secure NiFi API credentials
- Implement audit logging for all operations
- Use HTTPS for all communications