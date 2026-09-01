"""Script to create Supabase user for test authentication."""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.supabase_client import supabase_auth


async def create_supabase_user():
    """Create Supabase user for test phone +233540564567 with PIN 123456."""
    phone = "+233540564567"
    pin = "123456"
    
    print(f"Creating Supabase user for {phone}...")
    
    # Try to sign up the user in Supabase
    result = await supabase_auth.sign_up_with_phone(phone, pin)
    
    if result["success"]:
        print(f"Supabase user created successfully!")
        print(f"  Phone: {phone}")
        print(f"  PIN: {pin}")
        if result.get("session"):
            print(f"  Access Token: {result['session'].access_token[:50]}...")
    else:
        print(f"Failed to create Supabase user: {result.get('error')}")
        print("User might already exist in Supabase. Trying to sign in...")
        
        # Try to sign in instead
        login_result = await supabase_auth.sign_in_with_phone(phone, pin)
        if login_result["success"]:
            print(f"Successfully signed in existing user!")
            print(f"  Phone: {phone}")
            print(f"  PIN: {pin}")
        else:
            print(f"Sign in also failed: {login_result.get('error')}")


if __name__ == "__main__":
    asyncio.run(create_supabase_user())
