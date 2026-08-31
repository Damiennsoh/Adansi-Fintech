"""Import all routers."""
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.groups import router as groups_router
from app.routers.contributions import router as contributions_router
from app.routers.withdrawals import router as withdrawals_router
from app.routers.credit import router as credit_router
from app.routers.agents import router as agents_router
from app.routers.ussd import router as ussd_router
from app.routers.whatsapp import router as whatsapp_router
from app.routers.momo import router as momo_router
from app.routers.rates import router as rates_router
from app.routers.admin import router as admin_router
from app.routers.history import router as history_router

__all__ = [
    "auth_router", "users_router", "groups_router",
    "contributions_router", "withdrawals_router", "credit_router",
    "agents_router", "ussd_router", "whatsapp_router", "momo_router", "rates_router", "admin_router",
    "history_router"
]
