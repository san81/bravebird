# Architecture Overview

## Goals
- Provision isolated, ephemeral environments per job.
- Provide reliable job execution at scale.
- Capture artifacts and logs for post-run analysis.

## Components
- CLI: Submits jobs, checks status, fetches results/logs.
- SQS Queues: Priority queues (high/normal) + DLQ for failures.
- Worker/Orchestrator: Polls SQS, launches ECS tasks, tracks status.
- ECS Fargate Tasks: Run the agent per job.
- S3: Stores artifacts (screenshots, session metadata).
- CloudWatch: Centralized logs and metrics.
- VPC: Private subnets, NAT for outbound access, restricted metadata access.

## Execution Flow
1. User runs CLI `submit` with a task payload.
2. CLI publishes a job message to SQS.
3. Worker consumes message and launches an ECS task per job.
4. Agent runs the placeholder workflow and writes artifacts.
5. Artifacts are uploaded to S3.
6. Worker updates job status and exposes result URLs.

## Networking & Isolation
- ECS tasks run in private subnets with outbound-only NAT.
- Agent performs a metadata reachability guard and aborts if accessible.
- No shared volumes between tasks; each job is isolated.

## Concurrency & Scheduling
- Separate queues by priority.
- Worker can use weighted polling or dedicated consumers per queue.
- Rate limiting is enforced per user at job submission.

## Observability
- CloudWatch log groups per worker and per task.
- Artifacts stored in S3 with pre-signed URLs.
- Session metadata for replay (timestamps, steps).
- CloudWatch alarms on queue backlog and DLQ depth.
