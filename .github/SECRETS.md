# GitHub Secrets Configuration

To enable automated deployment, you need to configure the following secrets in your GitHub repository:

## Required Secrets

### Docker Hub Credentials
- **`DOCKERHUB_USERNAME`**: Your Docker Hub username
- **`DOCKERHUB_TOKEN`**: Your Docker Hub access token (not password)
  - Generate at: https://hub.docker.com/settings/security

### EC2 Server Access
- **`EC2_HOST`**: Your EC2 server's public IP address
  - Example: `3.76.214.67`
- **`EC2_PRIVATE_KEY`**: Your EC2 private key content
  - Copy the entire content of your `~/.ssh/housescanner-key.pem` file

## How to Add Secrets

1. Go to your GitHub repository
2. Click on **Settings**
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add each secret with the exact name and value

## Workflow Files

### Main Deployment (`deploy.yml`)
- **Trigger**: Automatically runs on push to `main` branch
- **Process**: 
  1. **Step 2**: Build and push Docker images to Docker Hub
  2. **Step 3**: Deploy to EC2 server using docker-compose

### Quick Update (`quick-update.yml`)
- **Trigger**: Manual execution via GitHub Actions tab
- **Options**: 
  - Choose specific component to update (all/client/backend/agents)
  - Skip build step to just redeploy existing images

## Example Secret Values

```bash
# DOCKERHUB_USERNAME
your_dockerhub_username

# DOCKERHUB_TOKEN
dckr_pat_1234567890abcdef...

# EC2_HOST
3.76.214.67

# EC2_PRIVATE_KEY
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
(your full private key content)
...
-----END RSA PRIVATE KEY-----
```

## Security Notes

- Never commit these secrets to your repository
- Regularly rotate your Docker Hub tokens
- Keep your EC2 private key secure
- Monitor GitHub Actions logs for any exposed sensitive information

## Testing the Workflow

1. Make a change to your code
2. Push to the `main` branch
3. Check the **Actions** tab in GitHub to monitor the deployment
4. The workflow will:
   - Build new Docker images with your changes
   - Push them to Docker Hub
   - Deploy to your EC2 server
   - Report success/failure status