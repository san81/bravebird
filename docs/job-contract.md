# Job Contract

## Job Request Schema
- job_id: string (UUID)
- task_input: string or object (task instructions)
- priority: string (high | normal)
- user_id: string
- timeout_seconds: number
- created_at: ISO-8601 timestamp

### Example Message (SQS)
```json
{
  "job_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "task_input": "Open browser -> Search -> Save screenshot",
  "priority": "normal",
  "user_id": "user-123",
  "timeout_seconds": 300,
  "created_at": "2026-02-03T18:45:00Z"
}
```

## Job Result Schema
- job_id: string
- status: string (queued | running | succeeded | failed)
- exit_code: number
- artifact_urls: array of strings
- logs_url: string
- duration_ms: number
- error_message: string | null
- completed_at: ISO-8601 timestamp

## Job Status Store
- DynamoDB `JobStatusTable` stores a `payload` field containing the JSON result.

### Example Result
```json
{
  "job_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "succeeded",
  "exit_code": 0,
  "artifact_urls": [
    "https://s3.amazonaws.com/bucket/jobs/9b1d/.../screenshot.png"
  ],
  "logs_url": "https://console.aws.amazon.com/cloudwatch/...",
  "duration_ms": 74210,
  "error_message": null,
  "completed_at": "2026-02-03T18:46:14Z"
}
```

## Storage Conventions (S3)
- jobs/{job_id}/artifacts/
- jobs/{job_id}/metadata.json
- jobs/{job_id}/logs/
