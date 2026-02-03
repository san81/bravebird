# Ops Notes

## Deployment
- CDK used to provision VPC, ECS, SQS, S3, IAM, CloudWatch.
- Single command deploy (e.g., `cdk deploy`).

## Runtime Operations
- Worker service scales based on queue depth.
- ECS task timeouts enforce max job duration.
- DLQ captures failed jobs for inspection and replay.
- Optional CLI rate limiting via DynamoDB `RateLimitTable` (per-user window).
- Job status metadata stored in DynamoDB `JobStatusTable`.
- CloudWatch alarms on SQS backlog and DLQ depth.

## Failure Handling
- Task start failures: retry up to N times, then DLQ.
- Task runtime failures: mark failed, upload error artifacts.
- Artifact upload errors: retry, then fail job if persistent.

## Cost Controls
- Max runtime enforced per job.
- Optional spot capacity for worker or task pools.

## Security
- IAM least-privilege for worker, agent, and CLI.
- Metadata endpoint blocked from containers.
- Agent performs a metadata reachability guard and aborts if accessible.
