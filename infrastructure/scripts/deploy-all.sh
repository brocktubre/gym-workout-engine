#!/bin/bash
set -euo pipefail

STAGE=${STAGE:-prod}
REGION="us-east-1"
ACCOUNT_ID="381753457015"

echo "🚀 Deploying Gym Workout Engine - Stage: $STAGE"

# Stack 2: DynamoDB
echo "📦 Deploying storage stack..."
aws cloudformation deploy \
  --template-file infrastructure/cloudformation/02-storage.yaml \
  --stack-name "gym-workout-engine-storage-${STAGE}" \
  --parameter-overrides Stage=$STAGE \
  --region $REGION \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset

# Stack 3: Backend Lambda + API Gateway
echo "⚡ Deploying backend stack..."

# First upload lambda zip (must be built before running this script)
if [ ! -f "backend/lambda.zip" ]; then
  echo "❌ backend/lambda.zip not found. Build it first:"
  echo "   cd backend && npm ci && npm run build"
  echo "   mkdir -p lambda-package/dist && cp -r dist/* lambda-package/dist/"
  echo "   cp package.json lambda-package/ && cd lambda-package && npm ci --omit=dev"
  echo "   zip -r ../lambda.zip ."
  exit 1
fi

aws s3 cp backend/lambda.zip s3://gym.oc.taglineconsultants.com/lambda/lambda.zip

aws cloudformation deploy \
  --template-file infrastructure/cloudformation/03-backend.yaml \
  --stack-name "gym-workout-engine-backend-${STAGE}" \
  --parameter-overrides Stage=$STAGE \
  --region $REGION \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset

# Get API endpoint
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "gym-workout-engine-backend-${STAGE}" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text --region $REGION)

echo "📡 API Endpoint: $API_ENDPOINT"

# Stack 4: Frontend CloudFront + Lambda@Edge
echo "🌐 Deploying frontend stack..."

# Package and upload Lambda@Edge code
echo "📦 Packaging Lambda@Edge auth function..."
cd infrastructure/lambda-edge-auth
zip -j edge-auth.zip index.js
aws s3 cp edge-auth.zip s3://gym.oc.taglineconsultants.com/lambda/edge-auth.zip
cd ../..

aws cloudformation deploy \
  --template-file infrastructure/cloudformation/04-frontend.yaml \
  --stack-name "gym-workout-engine-frontend-${STAGE}" \
  --parameter-overrides Stage=$STAGE ApiEndpoint=$API_ENDPOINT \
  --region $REGION \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset

# Get CloudFront domain
CF_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name "gym-workout-engine-frontend-${STAGE}" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionDomain'].OutputValue" \
  --output text --region $REGION)

echo "🔗 CloudFront Domain: $CF_DOMAIN"

# Stack 5: DNS
echo "🔗 Deploying DNS stack..."
aws cloudformation deploy \
  --template-file infrastructure/cloudformation/05-dns.yaml \
  --stack-name "gym-workout-engine-dns-${STAGE}" \
  --parameter-overrides CloudFrontDomain=$CF_DOMAIN \
  --region $REGION \
  --no-fail-on-empty-changeset

echo ""
echo "✅ Deployment complete!"
echo "🌍 Site: https://gym.oc.taglineconsultants.com"
echo ""
echo "⚠️  NOTE: If this is a first-time deployment, ensure NS delegation is"
echo "   configured at taglineconsultants.com registrar to point"
echo "   gym.oc.taglineconsultants.com to the Route53 hosted zone nameservers."
