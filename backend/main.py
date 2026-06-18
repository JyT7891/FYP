# Backend entry point for FastAPI application
from app import create_app

# Create FastAPI application instance using app factory
app = create_app()

# Run development server when executed directly
if __name__ == "__main__":
    # Start Uvicorn ASGI server for local development
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)