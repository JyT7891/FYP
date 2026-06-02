# app/routes/__init__.py
from . import predict, reports, admin, utility

# Export all routers
__all__ = ["predict", "reports", "admin", "utility"]