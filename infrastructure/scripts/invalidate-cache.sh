#!/bin/bash
set -euo pipefail
STAGE=${STAGE:-prod}
REGION="us-east-1"

CF_DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name "gym-workout-engine-frontend-${STAGE}" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text --region $REGION)

echo "Invalidating CloudFront distribution: $CF_DIST_ID"
aws cloudfront create-invalidation \
  --distribution-id "$CF_DIST_ID" \
  --paths "/*"
echo "✅ Cache invalidation created"
