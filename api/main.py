from fastapi import FastAPI

app = FastAPI(title="branchLM API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
