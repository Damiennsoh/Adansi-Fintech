from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.routers import admin as admin_module


@pytest.mark.asyncio
async def test_require_admin_accepts_admin_role_alias():
    user = SimpleNamespace(role="admin")

    result = await admin_module.require_admin(user=user, db=None)

    assert result is user


@pytest.mark.asyncio
async def test_require_admin_rejects_non_admin_role():
    user = SimpleNamespace(role="user")

    with pytest.raises(HTTPException):
        await admin_module.require_admin(user=user, db=None)
