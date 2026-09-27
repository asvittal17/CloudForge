from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.users import router as users_router
from app.routers.auth import router as auth_router
from app.routers.projects import router as projects_router
from app.routers.infrastructure import router as infrastructure_router
from app.routers.terraform import router as terraform_router
from app.routers.ai import router as ai_router


app = FastAPI(
    title="CloudForge API",
    description="AI-Powered Cloud Infrastructure & DevOps Automation Platform",
    version="0.1.0",
)


# ========================================
# CORS
# ========================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


# ========================================
# Routers
# ========================================

app.include_router(users_router)
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(infrastructure_router)
app.include_router(terraform_router)
app.include_router(ai_router)


# ========================================
# Root
# ========================================

@app.get("/")
def root():
    return {
        "message": "CloudForge API is running",
        "version": "0.1.0",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }