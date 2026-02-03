# Bravebird Platform & Infra Take-Home

Demonstrates a production-shaped backend that provisions ephemeral ECS Fargate environments to execute "computer use" tasks, with priority queuing and rich observability.

## Stack
- ECS Fargate, SQS, S3, CloudWatch, IAM, VPC
- IaC via AWS CDK
- CLI-only job submission

## Docs
- `docs/plan.md`
- `docs/architecture.md`
- `docs/job-contract.md`
- `docs/ops.md`

## Repo Layout
- `cdk/` CDK app and infrastructure modules
- `services/worker/` SQS polling + ECS task orchestration
- `services/agent/` Placeholder agent implementation
- `cli/` Job submit/status/results commands

## Current Implementation
- CDK scaffolding with VPC, SQS, S3, CloudWatch logs, ECS cluster, worker service, and agent task definition.
- Worker runs in Fargate, polls high/normal queues, and launches agent tasks.
- Agent uploads a placeholder artifact to S3.
- CLI can submit jobs and fetch status metadata from DynamoDB or S3.
- Optional rate limiting via DynamoDB at job submission.
- Agent aborts if metadata endpoint is reachable.

## Next Steps
- Improve rate limiting and queue weighting controls.

## CLI Usage (After Deploy)
- Submit a job with `bravebird submit --queue <HighPriorityQueueUrl|NormalPriorityQueueUrl> --task "<text>" --user <id>`.
- Fetch status with `bravebird status --bucket <ArtifactsBucketName> --job <job_id>`.
- Fetch results with `bravebird results --bucket <ArtifactsBucketName> --job <job_id>`.

## Rate Limiting (Optional)
- Set `RATE_LIMIT_TABLE` to the `RateLimitTableName` output.
- Optional `RATE_LIMIT_WINDOW_SECONDS` (default 5).

## Job Status Store (Optional)
- Set `STATUS_TABLE` to the `JobStatusTableName` output to read status from DynamoDB.

## Deploy (Baseline)
1. `cd cdk`
2. `npm install`
3. `npx cdk synth`
4. `npx cdk deploy --outputs-file cdk.out/outputs.json`

Note: ECS images are built for `linux/amd64` to avoid Apple Silicon runtime issues.

Outputs to capture:
- `HighPriorityQueueUrl`
- `NormalPriorityQueueUrl`
- `ArtifactsBucketName`
- `JobStatusTableName`
- `RateLimitTableName` (optional)

## Makefile Shortcuts
- `make cdk-install`
- `make cdk-synth`
- `make cdk-deploy`
- `make export-env`
- `make submit-demo`

## Export Outputs
- Run `./scripts/export-outputs.sh` to write a `.env` file with CDK outputs.
- See `.env.example` for expected keys.

## CLI .env Loading
- CLI auto-loads `.env` from repo root unless `BRAVEBIRD_SKIP_ENV=true`.
- Override path with `BRAVEBIRD_ENV_FILE=/path/to/.env`.
