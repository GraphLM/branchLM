# branchLM API

## Setup with uv

```bash
cd /Users/raiyanaaijaz/Documents/github/branchLM/api
uv venv
source .venv/bin/activate
uv pip install -e .
```

## Install additional packages

```bash
uv pip install <package-name>
```

## Run the API

```bash
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Test endpoint

```bash
curl http://127.0.0.1:8000/health
```
