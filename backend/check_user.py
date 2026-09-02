"""Script to check user data in database."""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.database import AsyncSessionLocal
from app.models import User
from sqlalchemy import select


async def check_user():
    """Check user data for phone +233540564567."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.phone == "+233540564567"))
        user = result.scalar_one_or_none()
        
        if user:
            print(f"User found:")
            print(f"  ID: {user.id}")
            print(f"  Phone: {user.phone}")
            print(f"  Full Name: {user.full_name}")
            print(f"  PIN Hash: {user.pin_hash}")
            print(f"  Is Verified: {user.is_verified}")
            print(f"  Is Active: {user.is_active}")
            print(f"  Role: {user.role}")
        else:
            print("User not found in database")


if __name__ == "__main__":
    asyncio.run(check_user())
