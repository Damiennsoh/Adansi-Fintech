"""Script to create test user in database."""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.database import AsyncSessionLocal
from app.models import User
from app.services.auth_service import auth_service
from sqlalchemy import select


async def create_test_user():
    """Create test user +233540564567 with PIN 123456."""
    async with AsyncSessionLocal() as session:
        # Check if user exists
        result = await session.execute(select(User).where(User.phone == "+233540564567"))
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            print(f"User {existing_user.phone} already exists. Updating PIN...")
            existing_user.pin_hash = auth_service.hash_pin("123456")
            existing_user.is_verified = True
            await session.commit()
            print("User PIN updated successfully.")
            return
        
        # Create new user
        pin_hash = auth_service.hash_pin("123456")
        new_user = User(
            phone="+233540564567",
            full_name="Test User",
            pin_hash=pin_hash,
            is_verified=True,
            role="user"
        )
        
        session.add(new_user)
        await session.commit()
        await session.refresh(new_user)
        
        print(f"Test user created successfully:")
        print(f"  Phone: +233540564567")
        print(f"  PIN: 123456")
        print(f"  User ID: {new_user.id}")


if __name__ == "__main__":
    asyncio.run(create_test_user())
