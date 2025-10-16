# HouseScanner Registry-Based Deployment

This deployment approach builds Docker images locally, pushes them to DockerHub, and then deploys to EC2 by pulling the pre-built images.

## Benefits

- ✅ **Fast EC2 deployments** - No building on EC2 (minutes instead of 30+ minutes)
- ✅ **Consistent images** - Same image across environments
- ✅ **Version tracking** - Images tagged with git commit hash
- ✅ **Rollback capability** - Easy to deploy previous versions
- ✅ **Resource efficient** - EC2 only needs to pull, not build

## Prerequisites

### 1. DockerHub Account Setup

1. Create a DockerHub account at https://hub.docker.com
2. Create an access token:
   - Go to Account Settings → Security → New Access Token
   - Give it a name (e.g., "housescanner-deployment")
   - Copy the token (you won't see it again!)

### 2. Update Configuration Files

#### Update `ansible/group_vars/env.yaml`:
```yaml
# Docker Registry Configuration
dockerhub_username: your_actual_dockerhub_username
```

#### Create `ansible/group_vars/secrets.yaml`:
```bash
cd ansible/group_vars
cp secrets.yaml.example secrets.yaml
# Edit secrets.yaml with your actual credentials
```

Edit `secrets.yaml`:
```yaml
db_password: your_secure_db_password
dockerhub_username: your_dockerhub_username
dockerhub_password: your_dockerhub_access_token  # Use access token, not password!
```

#### Encrypt secrets file (recommended):
```bash
ansible-vault encrypt ansible/group_vars/secrets.yaml
# Enter a vault password when prompted
```

### 3. Install Required Ansible Collections

```bash
ansible-galaxy collection install community.docker
ansible-galaxy collection install amazon.aws
```

### 4. Ensure Docker is Running Locally

```bash
docker --version
# Docker must be running on your machine to build images
```

## Deployment Process

The new playbook `deploy_server_app_with_registry.yml` performs these steps:

### Phase 1: Build and Push (Local Machine)
1. Builds Docker images locally with git commit hash tag
2. Pushes images to DockerHub
3. Tags images as both `<commit-hash>` and `latest`

### Phase 2: Provision Infrastructure (AWS)
4. Creates VPC, subnets, security groups
5. Creates RDS PostgreSQL database
6. Creates S3 bucket
7. Launches EC2 instance

### Phase 3: Deploy Application (EC2)
8. Installs Docker on EC2
9. Logs into DockerHub
10. Clones your repository
11. **Pulls pre-built images** from DockerHub
12. Starts containers
13. Runs database migrations

## Running the Deployment

### Full Deployment (Build + Deploy)
```bash
cd ansible

# If you encrypted secrets.yaml:
ansible-playbook deploy_server_app_with_registry.yml --ask-vault-pass

# If secrets.yaml is not encrypted:
ansible-playbook deploy_server_app_with_registry.yml
```

### Quick Re-deployment (Using Existing Images)

If you just want to deploy with existing images (no rebuild):

```bash
# Edit env.yaml to set a specific image tag
ansible-playbook deploy_server_app_with_registry.yml --skip-tags build
```

## Image Tagging Strategy

Images are tagged with:
1. **Git commit hash** (e.g., `abc123f`) - For versioning and rollbacks
2. **latest** - Always points to the most recent build

Example:
```
your_username/housescanner-backend:abc123f
your_username/housescanner-backend:latest
```

## Updating docker-compose.prod.yml

The `docker-compose.prod.yml` now supports both:
- **Registry mode** (default) - Uses pre-built images from DockerHub
- **Build mode** (fallback) - Can still build locally if needed

Environment variables control which images to use:
```bash
export DOCKERHUB_USERNAME=your_username
export IMAGE_TAG=abc123f
docker compose -f docker-compose.prod.yml up
```

## Rollback to Previous Version

To deploy a previous version:

1. Find the commit hash of the version you want:
   ```bash
   git log --oneline
   ```

2. Edit the deployment to use that tag, or manually on EC2:
   ```bash
   ssh ubuntu@<EC2_IP>
   cd /opt/housescanner
   export IMAGE_TAG=<old-commit-hash>
   docker compose -f docker-compose.prod.yml pull
   docker compose -f docker-compose.prod.yml up -d
   ```

## Troubleshooting

### Build fails locally
- Ensure Docker is running: `docker ps`
- Check you're in the correct directory
- Verify Dockerfiles exist in each service directory

### Push fails
- Verify DockerHub credentials in `secrets.yaml`
- Ensure you're logged in: `docker login`
- Check access token has write permissions

### EC2 can't pull images
- Images must be **public** on DockerHub, OR
- EC2 must be logged into DockerHub (playbook handles this)
- Check image names match exactly

### Services won't start on EC2
- Check logs: `docker compose logs`
- Verify environment variables in `.env.prod` files
- Ensure RDS endpoint is reachable

## Teardown

To destroy all infrastructure:
```bash
ansible-playbook teardown_server_app.yml --ask-vault-pass
```

⚠️ **Warning**: This will delete everything including the database!

## Cost Optimization

This approach reduces costs:
- Smaller EC2 instance possible (no build requirements)
- Faster deployments = less billable time
- Images cached on DockerHub (faster subsequent pulls)

## Security Notes

1. **Never commit secrets.yaml** - Add to `.gitignore`
2. **Use ansible-vault** to encrypt secrets
3. **Use DockerHub access tokens** instead of passwords
4. **Set DockerHub repos to private** for production
5. **Rotate credentials** regularly
