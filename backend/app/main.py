from fastapi import FastAPI

from app.routers.users import router as users_router
from app.routers.auth import router as auth_router
from app.routers.projects import router as projects_router


app = FastAPI(
    title="CloudForge API",
    description="AI-Powered Cloud Infrastructure & DevOps Automation Platform",
    version="0.1.0",
)


app.include_router(users_router)
app.include_router(auth_router)
app.include_router(projects_router)


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