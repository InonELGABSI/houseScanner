#!/bin/bash
# HouseScanner Pre-Deployment Setup Script
# Run this before executing the Ansible playbook

set -e

echo "=========================================="
echo "HouseScanner Pre-Deployment Setup"
echo "=========================================="
echo ""

# Check if running on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "✓ Detected macOS"
else
    echo "✓ Detected Linux/Unix"
fi

# Check Ansible installation
echo ""
echo "Checking prerequisites..."
if ! command -v ansible &> /dev/null; then
    echo "❌ Ansible is not installed"
    echo "Install with: pip3 install ansible boto3 botocore"
    exit 1
else
    echo "✓ Ansible is installed"
fi

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "⚠️  AWS CLI is not installed (optional but recommended)"
    echo "Install with: brew install awscli (macOS) or pip3 install awscli"
else
    echo "✓ AWS CLI is installed"
fi

# Check for AWS credentials
echo ""
echo "Checking AWS credentials..."
if [ ! -f ~/.aws/credentials ] && [ -z "$AWS_ACCESS_KEY_ID" ]; then
    echo "❌ AWS credentials not found"
    echo "Configure with: aws configure"
    exit 1
else
    echo "✓ AWS credentials found"
fi

# Create secrets file if it doesn't exist
echo ""
echo "Setting up secrets file..."
cd "$(dirname "$0")"
if [ ! -f "group_vars/secrets.yaml" ]; then
    cp group_vars/secrets.yaml.example group_vars/secrets.yaml
    echo "✓ Created group_vars/secrets.yaml from example"
    echo ""
    echo "⚠️  IMPORTANT: Edit group_vars/secrets.yaml and update all values!"
    echo "Then encrypt it with: ansible-vault encrypt group_vars/secrets.yaml"
    echo ""
    read -p "Press Enter to open secrets.yaml for editing..." 
    ${EDITOR:-nano} group_vars/secrets.yaml
else
    echo "✓ secrets.yaml already exists"
fi

# Check if secrets file is encrypted
if grep -q "\$ANSIBLE_VAULT" group_vars/secrets.yaml 2>/dev/null; then
    echo "✓ secrets.yaml is encrypted"
else
    echo "⚠️  secrets.yaml is NOT encrypted"
    read -p "Do you want to encrypt it now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ansible-vault encrypt group_vars/secrets.yaml
        echo "✓ secrets.yaml encrypted"
    fi
fi

# Generate JWT secret if needed
echo ""
echo "Checking JWT secret..."
if grep -q "CHANGE_ME_GENERATE_64_CHAR_RANDOM_STRING" group_vars/secrets.yaml 2>/dev/null; then
    echo "⚠️  JWT secret needs to be generated"
    JWT_SECRET=$(openssl rand -base64 48 | tr -d "=+/" | cut -c1-64)
    echo "Generated JWT secret: $JWT_SECRET"
    echo "Add this to your secrets.yaml file"
else
    echo "✓ JWT secret appears to be set"
fi

# Check SSH key for GitHub
echo ""
echo "Checking SSH keys for GitHub access..."
if [ ! -f ~/.ssh/id_rsa ]; then
    echo "⚠️  No SSH key found at ~/.ssh/id_rsa"
    read -p "Do you want to generate one? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ssh-keygen -t rsa -b 4096 -C "housescanner-deploy"
        echo ""
        echo "✓ SSH key generated"
        echo "Add this public key to your GitHub account:"
        echo ""
        cat ~/.ssh/id_rsa.pub
        echo ""
        read -p "Press Enter after adding the key to GitHub..."
    fi
else
    echo "✓ SSH key found"
fi

echo ""
echo "=========================================="
echo "Pre-deployment checklist:"
echo "=========================================="
echo ""
echo "Before running the deployment, ensure:"
echo ""
echo "1. AWS Account Setup:"
echo "   ☐ AWS account with sufficient permissions"
echo "   ☐ AWS CLI configured with credentials"
echo "   ☐ IAM user has EC2, RDS, S3, VPC permissions"
echo ""
echo "2. AWS Console Tasks (MANUAL STEPS REQUIRED):"
echo "   ☐ Create EC2 Key Pair named 'housescanner-key' in us-east-1"
echo "   ☐ Download the .pem file and save it securely"
echo "   ☐ Run: chmod 400 ~/path/to/housescanner-key.pem"
echo ""
echo "3. Configuration Files:"
echo "   ☐ Updated group_vars/secrets.yaml with all credentials"
echo "   ☐ Encrypted secrets.yaml with ansible-vault"
echo "   ☐ Reviewed group_vars/env.yaml settings"
echo "   ☐ S3 bucket name in env.yaml is globally unique"
echo ""
echo "4. Repository Access:"
echo "   ☐ SSH key added to GitHub account"
echo "   ☐ Repository is accessible"
echo ""
echo "5. API Keys:"
echo "   ☐ OpenAI API key is valid and has credits"
echo "   ☐ LangSmith key (optional) is configured"
echo ""
echo "=========================================="
echo ""
read -p "Have you completed all checklist items? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please complete the checklist before deploying."
    exit 1
fi

echo ""
echo "✓ Ready to deploy!"
echo ""
echo "Run deployment with:"
echo "  ansible-playbook deploy_server_app.yml --ask-vault-pass"
echo ""
echo "Or if you have a vault password file:"
echo "  ansible-playbook deploy_server_app.yml --vault-password-file ~/.vault_pass"
echo ""
