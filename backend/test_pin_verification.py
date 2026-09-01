"""Script to test PIN verification."""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.database import AsyncSessionLocal
from app.models import User
from app.services.auth_service import auth_service
from sqlalchemy import select


async def test_pin():
    """Test PIN verification for user +233540564567."""
    phone = "+233540564567"
    test_pin = "123456"
    
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.phone == phone))
        user = result.scalar_one_or_none()
        
        if user:
            print(f"Testing PIN verification for {phone}")
            print(f"  Test PIN: {test_pin}")
            print(f"  Stored Hash: {user.pin_hash}")
            
            # Test verification
            is_valid = auth_service.verify_pin(test_pin, user.pin_hash)
            print(f"  PIN Valid: {is_valid}")
            
            # Test with wrong PIN
            is_valid_wrong = auth_service.verify_pin("000000", user.pin_hash)
            print(f"  Wrong PIN Valid: {is_valid_wrong}")
        else:
            print("User not found")


if __name__ == "__main__":
    asyncio.run(test_pin())
