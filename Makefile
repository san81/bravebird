SHELL := /bin/bash

.PHONY: help cdk-install cdk-synth cdk-deploy export-env cli-build worker-build agent-build submit-demo

help:
	@echo "Targets:"
	@echo "  cdk-install   Install CDK dependencies"
	@echo "  cdk-synth     Synthesize CloudFormation"
	@echo "  cdk-deploy    Deploy the stack"
	@echo "  export-env    Export CDK outputs to .env"
	@echo "  cli-build     Build CLI"
	@echo "  worker-build  Build worker service"
	@echo "  agent-build   Build agent service"
	@echo "  submit-demo   Submit a demo job using .env defaults"

cdk-install:
	cd cdk && npm install

cdk-synth:
	cd cdk && npx cdk synth

cdk-deploy:
	cd cdk && npx cdk deploy --outputs-file cdk.out/outputs.json

export-env:
	./scripts/export-outputs.sh

cli-build:
	cd cli && npm install && npm run build

worker-build:
	cd services/worker && npm install && npm run build

agent-build:
	cd services/agent && npm install && npm run build

submit-demo:
	cd cli && npm install && npm run build
	@if [[ ! -f .env ]]; then \
		echo "Missing .env. Run: make cdk-deploy && make export-env"; \
		exit 1; \
	fi
	cd cli && BRAVEBIRD_ENV_FILE=../.env node dist/index.js submit --task "Open browser -> Search -> Save screenshot" --user demo-user
