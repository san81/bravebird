# Bravebird Platform & Infra Take-Home Plan

## Scope & Stack
- AWS: ECS Fargate, SQS, S3, CloudWatch, IAM, VPC
- CLI-only job submission
- Deep-dives: Concurrency & Scheduling, Observability
- IaC: AWS CDK

## Architecture (High Level)
- CLI submits a job to SQS.
- Worker service polls SQS and launches an ECS task per job.
- Agent task executes the placeholder “computer use” workflow.
- Artifacts/logs are stored and retrievable via pre-signed URLs.

## Detailed Plan

1. Requirements Lock-In
- Confirm AWS services: ECS Fargate, SQS, S3, CloudWatch, IAM, VPC.
- Confirm deep-dives: Concurrency & Scheduling, Observability.
- Confirm job submission via CLI only (no HTTP API).

2. Architecture Definition
- Define core components: CLI, Job Queue, Worker/Orchestrator, ECS Task Runner, Artifact Storage.
- Define job lifecycle: queued → running → succeeded/failed with timestamps.
- Define control plane vs data plane responsibilities.
- Create a minimal sequence diagram for job execution flow.

3. Job Contract
- Define job request schema: job_id, task_input, priority, user_id, timeout_seconds, created_at.
- Define job result schema: status, exit_code, artifact_urls, logs_url, duration_ms, error_message.
- Define S3 storage naming conventions.
- Define queue message format and versioning.

4. CLI Design
- Commands: submit, status, results, logs.
- Inputs: task payload from JSON or flags.
- Outputs: job id, status, pre-signed URLs.
- Authentication: AWS profile/role usage.
- Retry and error handling.

5. Concurrency & Scheduling Deep-Dive
- Define SQS queues: high, normal, optional low.
- Define worker strategy: weighted polling or dedicated consumers per priority.
- Implement rate limiting per user: DynamoDB token bucket or Redis (ElastiCache) if needed.
- Configure SQS visibility timeout and retries.
- Define DLQ policy and failure thresholds.

6. Observability Deep-Dive
- CloudWatch log groups per job and per worker.
- Stream logs from ECS tasks to CloudWatch.
- Artifact capture: screenshot/video in S3.
- Pre-signed URLs for retrieval via CLI.
- Add “session replay” metadata file with timing and step markers.

7. Execution Environment
- Define ECS task definition with agent container.
- Ensure strict per-job isolation (no shared volumes).
- Define network settings: private subnets, NAT for outbound access.
- Block metadata access (169.254.169.254) using task role or container firewall.

8. Safety & Reaping
- Task timeouts enforced via ECS settings.
- Watchdog in worker to kill stuck tasks.
- SQS visibility timeouts aligned with max runtime.
- Cleanup of partial artifacts.

9. IaC with CDK
- CDK app scaffold.
- VPC: public/private subnets, NAT gateway.
- ECS cluster + task definitions.
- SQS queues + DLQ.
- S3 bucket for artifacts.
- IAM roles for ECS tasks, worker, and CLI access.
- CloudWatch log groups.
- Outputs: queue URLs, bucket name, cluster/task ARNs.

10. Worker/Orchestrator
- Long-running worker process (ECS service or EC2).
- Poll SQS, validate job message.
- Launch ECS task per job.
- Track task status and update job state.
- Emit logs and metrics.

11. Failure Modes
- Task fails to start → retry and DLQ after N attempts.
- Agent crash → mark failed and upload error artifact.
- S3 upload failure → retry or mark failed.
- Queue backlog → scale worker concurrency.

12. Documentation & Demo
- README: architecture, setup, and tradeoffs.
- Step-by-step: cdk deploy, cli submit, cli results.
- Example payload and expected outputs.
- “What I’d build next” section.

## Proposed Repo Structure
- cdk/
- cdk/bin/
- cdk/lib/
- cdk/lib/network/
- cdk/lib/compute/
- cdk/lib/storage/
- cdk/lib/observability/
- cdk/lib/queueing/
- cdk/lib/iam/
- cdk/lib/app-stack.ts
- services/
- services/worker/
- services/worker/src/
- services/worker/Dockerfile
- services/agent/
- services/agent/src/
- services/agent/Dockerfile
- cli/
- cli/src/
- docs/
- docs/architecture.md
- docs/job-contract.md
- docs/ops.md
- README.md
