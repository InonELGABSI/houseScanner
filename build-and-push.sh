#!/bin/bash

# Build and Push Docker Images to DockerHub
# Usage: ./build-and-push.sh [version_tag]
# Example: ./build-and-push.sh v1.0.0
# If no version is provided, it defaults to 'latest'

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOCKER_USERNAME="${DOCKER_USERNAME:-}"
VERSION="${1:-latest}"
REGISTRY="${DOCKER_REGISTRY:-docker.io}"  # Can override to use ECR or other registry

# Services to build
SERVICES=("agents-service" "backend" "client-pwa")

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Docker Image Build and Push${NC}"
echo -e "${GREEN}======================================${NC}"
echo -e "Registry: ${REGISTRY}"
echo -e "Version: ${VERSION}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Prompt for Docker username if not set
if [ -z "$DOCKER_USERNAME" ]; then
    echo -e "${YELLOW}Enter your DockerHub username:${NC}"
    read -r DOCKER_USERNAME
fi

# Validate username
if [ -z "$DOCKER_USERNAME" ]; then
    echo -e "${RED}Error: Docker username is required${NC}"
    exit 1
fi

# Login to DockerHub
echo -e "${YELLOW}Logging in to DockerHub...${NC}"
if ! docker login "$REGISTRY"; then
    echo -e "${RED}Error: Docker login failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Successfully logged in${NC}"
echo ""

# Build and push each service
for SERVICE in "${SERVICES[@]}"; do
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}Building: ${SERVICE}${NC}"
    echo -e "${GREEN}======================================${NC}"
    
    # Determine image name (normalize client-pwa to client)
    if [ "$SERVICE" = "client-pwa" ]; then
        IMAGE_NAME="housescanner-client"
        CONTEXT="./client-pwa"
    else
        IMAGE_NAME="housescanner-${SERVICE}"
        CONTEXT="./${SERVICE}"
    fi
    
    FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}"
    
    echo -e "Image: ${FULL_IMAGE_NAME}:${VERSION}"
    echo -e "Context: ${CONTEXT}"
    echo ""
    
    # Build the image
    echo -e "${YELLOW}Building image...${NC}"
    if docker build \
        -t "${FULL_IMAGE_NAME}:${VERSION}" \
        -t "${FULL_IMAGE_NAME}:latest" \
        -f "${CONTEXT}/Dockerfile.prod" \
        "${CONTEXT}"; then
        echo -e "${GREEN}✓ Build successful${NC}"
    else
        echo -e "${RED}✗ Build failed for ${SERVICE}${NC}"
        exit 1
    fi
    
    # Push the versioned tag
    echo -e "${YELLOW}Pushing ${FULL_IMAGE_NAME}:${VERSION}...${NC}"
    if docker push "${FULL_IMAGE_NAME}:${VERSION}"; then
        echo -e "${GREEN}✓ Push successful${NC}"
    else
        echo -e "${RED}✗ Push failed for ${SERVICE}:${VERSION}${NC}"
        exit 1
    fi
    
    # Push the latest tag
    echo -e "${YELLOW}Pushing ${FULL_IMAGE_NAME}:latest...${NC}"
    if docker push "${FULL_IMAGE_NAME}:latest"; then
        echo -e "${GREEN}✓ Push successful${NC}"
    else
        echo -e "${RED}✗ Push failed for ${SERVICE}:latest${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ ${SERVICE} completed successfully${NC}"
    echo ""
done

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}All images built and pushed!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Images pushed:"
for SERVICE in "${SERVICES[@]}"; do
    if [ "$SERVICE" = "client-pwa" ]; then
        IMAGE_NAME="housescanner-client"
    else
        IMAGE_NAME="housescanner-${SERVICE}"
    fi
    echo "  - ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
    echo "  - ${DOCKER_USERNAME}/${IMAGE_NAME}:latest"
done
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update ansible/group_vars/env.yaml with DOCKER_USERNAME=${DOCKER_USERNAME}"
echo "2. Run: ansible-playbook ansible/deploy_server_app.yml"
