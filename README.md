# 🏋️ Gym Workout Engine

A serverless, intelligent workout generation platform built on AWS. Generates personalised gym sessions using a rule-based engine, served through a dark-mode Apple Fitness–inspired UI, protected by PIN authentication at the CDN edge.

---

## Overview

**Gym Workout Engine** is a full-stack serverless application that generates structured gym workouts based on configurable rules. Users answer a brief intake form (muscle groups, session type, available equipment, fatigue level) and the engine produces a complete workout plan with sets, reps, rest periods, and progression guidance.

### Key Features

| Feature | Detail |
|---|---|
| 🧠 Intelligent Workout Generation | Rule-based engine that balances muscle groups, avoids overtraining, and applies progressive overload |
| ⚙️ Configurable Rules | 8 engine rules governing volume, intensity, compound/isolation ratio, rest days, and more |
| 🎨 Apple Fitness Aesthetic | Dark-mode, SF Pro Display–inspired UI built with React and Tailwind CSS |
| 🔐 PIN Protection | 6-digit PIN authentication at the CloudFront edge via Lambda@Edge (no origin hit needed) |
| ☁️ Full AWS Serverless Stack | CloudFront → Lambda@Edge → S3 (frontend) + API Gateway → Lambda → DynamoDB |
| 📱 Mobile First | Fully responsive with `dvh` units, native numpad keypad, and touch-optimised interactions |

---

## Live URL

**[https://gym.oc.taglineconsultants.com](https://gym.oc.taglineconsultants.com)**

> 🔑 PIN: _ask Brock_

---

## Architecture

```
                          ┌─────────────────────────────────────────────┐
                          │            AWS us-east-1                     │
                          │                                              │
  Browser ──HTTPS──▶  CloudFront (gym.oc.taglineconsultants.com)           │
                          │        │                                     │
                          │  Lambda@Edge (viewer-request)                │
                          │  ┌─────────────────────────────┐            │
                          │  │  PIN Auth (index.js)        │            │
                          │  │  • Cookie check             │            │
                          │  │  • Show PIN keypad page     │            │
                          │  │  • Validate PIN → Set cookie│            │
                          │  └────────────┬────────────────┘            │
                          │               │ authenticated                │
                          │        ┌──────┴──────┐                      │
                          │        │             │                      │
                          │     S3 Origin    API Origin                 │
                          │  (frontend SPA)  /api/* path                │
                          │   index.html      │                         │
                          │   assets/         ▼                         │
                          │              API Gateway HTTP               │
                          │              (gym-workout-engine-api-prod)  │
                          │                   │                         │
                          │                   ▼                         │
                          │            Lambda (nodejs20.x)              │
                          │            gym-workout-engine-api-prod      │
                          │                   │                         │
                          │                   ▼                         │
                          │           DynamoDB (PAY_PER_REQUEST)        │
                          │           gym-workout-engine-prod            │
                          │                                              │
                          └─────────────────────────────────────────────┘

  DNS:  gym.oc.taglineconsultants.com (Route53 zone Z06672042E3V34N26VIQA)
        A ALIAS → CloudFront distribution domain
```

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS | SPA deployed to S3, served via CloudFront |
| **Frontend Auth** | Lambda@Edge (Node.js 20) | Viewer-request handler; 30-day auth cookie |
| **Backend** | Node.js 20, TypeScript, AWS Lambda | Handler: `lambda.handler`, 512 MB, 30s timeout |
| **API** | Amazon API Gateway HTTP API (v2) | `$default` catch-all route, CORS configured |
| **Database** | Amazon DynamoDB | PAY_PER_REQUEST, PITR enabled, single-table design |
| **CDN** | Amazon CloudFront | OAC for S3, HTTP/2+3, TLS 1.2+, PriceClass_100 |
| **Storage** | Amazon S3 | `gym.oc.taglineconsultants.com` bucket, OAC-only access |
| **TLS** | AWS ACM (us-east-1) | Pre-provisioned cert, DNS-validated |
| **DNS** | Amazon Route53 | Hosted zone `Z06672042E3V34N26VIQA`, A alias record |
| **IaC** | AWS CloudFormation | 5 stacks: certificate, storage, backend, frontend, DNS |
| **CI/CD** | GitHub Actions | 3 workflows: infra, backend, frontend; path-triggered |

---

## Local Development

### Prerequisites

- **Node.js** 20+ (`node --version`)
- **npm** 10+
- **AWS CLI** v2 (`aws --version`)
- AWS credentials configured (`aws configure` or environment variables)

### Clone & Install

```bash
git clone https://github.com/<your-org>/gym-workout-engine.git
cd gym-workout-engine
```

### Backend (API Server)

```bash
cd backend
npm install
npm run dev        # Starts on http://localhost:3001
```

The dev server runs Express locally with `ts-node` and connects to DynamoDB (uses `AWS_REGION` and credentials from your environment or `~/.aws`).

Set `TABLE_NAME` to point to a dev/staging table:

```bash
TABLE_NAME=gym-workout-engine-dev npm run dev
```

### Frontend (React SPA)

```bash
cd frontend
npm install
npm run dev        # Starts on http://localhost:5173
```

Vite proxies `/api/*` requests to `http://localhost:3001` in development.

---

## Environment Variables

### Backend (`backend/.env`)

```env
TABLE_NAME=gym-workout-engine-dev
STAGE=dev
FRONTEND_URL=http://localhost:5173
AWS_REGION=us-east-1
PORT=3001
```

### Frontend (`frontend/.env.local`)

```env
# Leave empty to use CloudFront /api/* proxy (production default)
# Set to http://localhost:3001 for local dev against local backend
VITE_API_URL=http://localhost:3001
```

> ⚠️ Never commit `.env` files. They are listed in `.gitignore`.

---

## Deployment

### Prerequisites

1. **AWS IAM User or Role** with the permissions listed in the [IAM Permissions](#iam-permissions-required) section.
2. A **GitHub repository** with the following secrets configured in **Settings → Secrets and variables → Actions**:

| Secret | Description |
|---|---|
| `DEPLOY_AWS_ACCESS_KEY_ID` | IAM access key ID for deployments |
| `DEPLOY_AWS_SECRET_ACCESS_KEY` | IAM secret access key for deployments |

### Automatic Deployment (Recommended)

Push to `main` — GitHub Actions picks up the changed paths and runs only the relevant workflow:

| Changed path | Workflow triggered |
|---|---|
| `infrastructure/cloudformation/**` | `deploy-infra.yml` (all 4 stacks) |
| `backend/**` | `deploy-backend.yml` (Lambda code update) |
| `frontend/**` | `deploy-frontend.yml` (S3 sync + CloudFront invalidation) |

### Manual Deployment

Trigger any workflow from the **GitHub Actions** tab using `workflow_dispatch`. For `deploy-infra.yml` you can also select a `stage` (prod/staging).

### First-Time Full Deploy (from scratch)

```bash
# 1. Build backend zip
cd backend
npm ci && npm run build
mkdir -p lambda-package/dist
cp -r dist/* lambda-package/dist/
cp package.json lambda-package/
cd lambda-package && npm ci --omit=dev && cd ..
zip -r lambda.zip lambda-package/
cd ..

# 2. Run the all-in-one deploy script
export STAGE=prod
bash infrastructure/scripts/deploy-all.sh
```

---

## ⚠️ DNS Delegation Required

`gym.oc.taglineconsultants.com` has been delegated to a **dedicated Route53 hosted zone** (`Z06672042E3V34N26VIQA`). For DNS to resolve correctly, you **must** add the following 4 NS records at your domain registrar for `taglineconsultants.com`:

```
Name:  gym.oc.taglineconsultants.com
Type:  NS
TTL:   172800

Values:
  ns-1454.awsdns-53.org
  ns-411.awsdns-51.com
  ns-1974.awsdns-54.co.uk
  ns-662.awsdns-18.net
```

> **To verify the nameservers for your hosted zone:**
> ```bash
> aws route53 get-hosted-zone --id Z06672042E3V34N26VIQA \
>   --query "DelegationSet.NameServers"
> ```

Until these records are in place, `gym.oc.taglineconsultants.com` will not resolve, even though CloudFront and Route53 are fully deployed.

---

## Workout Engine Rules

The engine applies 8 rules when generating a workout session:

| # | Rule | Description |
|---|---|---|
| 1 | **Compound First** | Multi-joint compound movements (squat, deadlift, bench, row) are always programmed before isolation exercises to prioritise neuromuscular demand while the athlete is fresh. |
| 2 | **Volume Targets** | Each muscle group has a weekly MEV (Minimum Effective Volume) and MRV (Maximum Recoverable Volume). The engine caps per-session volume within these bounds based on the user's experience level. |
| 3 | **Intensity Modulation** | Rep ranges are assigned by movement type: 3–6 reps for main strength work, 8–12 for hypertrophy accessories, 12–20 for isolation finishers. |
| 4 | **Push/Pull Balance** | For full-body and upper-body sessions, the engine enforces a ≥1:1 pull-to-push ratio to protect shoulder health. |
| 5 | **Fatigue Guard** | If the user selects high fatigue, the engine reduces total volume by 30%, removes the top-intensity set, and substitutes machine variants for free-weight compounds. |
| 6 | **Equipment Filter** | All exercise candidates are filtered against the user's available equipment before selection. Exercises requiring unavailable equipment are never generated. |
| 7 | **Recency Avoidance** | The engine reads the last 7 days of session history from DynamoDB and excludes exercises trained in the previous 48 hours for that muscle group. |
| 8 | **Progressive Overload Cue** | If the user logged the same exercise in the previous session at target reps, the engine attaches a "+2.5 kg / +1 rep" suggestion to the exercise card. |

---

## DynamoDB Schema

**Table name:** `gym-workout-engine-prod` (single-table design)

### Key Patterns

| Entity | PK | SK | GSI1PK | GSI1SK |
|---|---|---|---|---|
| Exercise definition | `EXERCISE#<id>` | `METADATA` | `EXERCISE` | `<muscleGroup>#<name>` |
| User session | `USER#<userId>` | `SESSION#<isoDate>#<sessionId>` | `SESSION` | `<isoDate>` |
| Workout log entry | `USER#<userId>` | `LOG#<sessionId>#<exerciseId>` | `USER#<userId>` | `LOG#<isoDate>` |
| User preferences | `USER#<userId>` | `PREFS` | — | — |

### Attribute Examples

**Exercise item:**
```json
{
  "PK": "EXERCISE#barbell-back-squat",
  "SK": "METADATA",
  "entityType": "Exercise",
  "id": "barbell-back-squat",
  "name": "Barbell Back Squat",
  "muscleGroup": "quads",
  "secondaryMuscles": ["glutes", "hamstrings"],
  "movementType": "compound",
  "equipment": ["barbell", "squat-rack"],
  "defaultReps": { "min": 4, "max": 8 },
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Session item:**
```json
{
  "PK": "USER#brock",
  "SK": "SESSION#2024-06-15T09:30:00.000Z#sess_abc123",
  "entityType": "Session",
  "sessionId": "sess_abc123",
  "userId": "brock",
  "sessionType": "upper",
  "fatigueLevel": "normal",
  "exercises": ["barbell-bench-press", "barbell-row", "dumbbell-shoulder-press"],
  "completedAt": "2024-06-15T10:45:00.000Z"
}
```

---

## IAM Permissions Required

The `DEPLOY_AWS_ACCESS_KEY_ID` / `DEPLOY_AWS_SECRET_ACCESS_KEY` credentials must have the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateStack",
        "cloudformation:UpdateStack",
        "cloudformation:DeleteStack",
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackEvents",
        "cloudformation:DescribeStackResources",
        "cloudformation:GetTemplate",
        "cloudformation:ValidateTemplate",
        "cloudformation:CreateChangeSet",
        "cloudformation:ExecuteChangeSet",
        "cloudformation:DescribeChangeSets"
      ],
      "Resource": "arn:aws:cloudformation:us-east-1:381753457015:stack/gym-workout-engine-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:PutBucketPolicy",
        "s3:GetBucketPolicy"
      ],
      "Resource": [
        "arn:aws:s3:::gym.oc.taglineconsultants.com",
        "arn:aws:s3:::gym.oc.taglineconsultants.com/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:GetFunction",
        "lambda:GetFunctionConfiguration",
        "lambda:PublishVersion",
        "lambda:AddPermission",
        "lambda:RemovePermission",
        "lambda:ListVersionsByFunction",
        "lambda:WaitForFunction"
      ],
      "Resource": "arn:aws:lambda:us-east-1:381753457015:function:gym-workout-engine-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction",
        "lambda:UpdateFunctionCode",
        "lambda:PublishVersion",
        "lambda:GetFunction"
      ],
      "Resource": "arn:aws:lambda:*:381753457015:function:gym-workout-engine-edge-auth-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:DescribeTable",
        "dynamodb:UpdateTable",
        "dynamodb:DeleteTable",
        "dynamodb:TagResource"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:381753457015:table/gym-workout-engine-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "apigateway:POST",
        "apigateway:PUT",
        "apigateway:PATCH",
        "apigateway:DELETE",
        "apigateway:GET"
      ],
      "Resource": "arn:aws:apigateway:us-east-1::/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateDistribution",
        "cloudfront:UpdateDistribution",
        "cloudfront:GetDistribution",
        "cloudfront:CreateInvalidation",
        "cloudfront:CreateOriginAccessControl",
        "cloudfront:GetOriginAccessControl"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "route53:ChangeResourceRecordSets",
        "route53:GetHostedZone",
        "route53:ListResourceRecordSets"
      ],
      "Resource": "arn:aws:route53:::hostedzone/Z06672042E3V34N26VIQA"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRole",
        "iam:PassRole"
      ],
      "Resource": "arn:aws:iam::381753457015:role/gym-workout-engine-*"
    }
  ]
}
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit changes: `git commit -m 'feat: add my feature'`
4. Push: `git push origin feat/my-feature`
5. Open a Pull Request targeting `main`

Please keep PRs focused. Infrastructure changes should be accompanied by a description of what AWS resources are created or modified.

---

## License

MIT © Brock / Tagline Consultants
