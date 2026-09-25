from fastapi import FastAPI

app = FastAPI(
    title="CloudForge API",
    description="AI-Powered Cloud Infrastructure & DevOps Automation Platform",
    version="0.1.0",
)


@app.get("/")
def root():
    return {
        "message": "CloudForge API is running",
        "version": "0.1.0"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }