"""Ensure users table has columns added after initial deployment (email, auth_user_id, ghana_card fields, credit scoring fields).

Safe to run multiple times: each ADD COLUMN is guarded by an information_schema check so existing columns are skipped.

Revision ID: 002_add_users_email_and_missing_columns
Revises: 001_add_rotation_columns
Create Date: 2026-09-04 17:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002_add_users_email_and_missing_columns'
down_revision = '001_add_rotation_columns'
branch_labels = None
depends_on = None


def _column_exists(table_name: str, column_name: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
    ), {"t": table_name, "c": column_name})
    return result.fetchone() is not None


def _add_column_if_missing(table: str, column, **kw) -> None:
    if not _column_exists(table, column.name):
        op.add_column(table, column, **kw)


def upgrade() -> None:
    # Ensure users table exists; if not, this is a fresh DB and Base.metadata.create_all
    # (called at app startup) will create the full table, so we can skip this migration.
    conn = op.get_bind()
    table_exists = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = 'users'"
    )).fetchone() is not None
    if not table_exists:
        return

    # ---- Missing columns on users table -------------------------------------
    _add_column_if_missing(
        'users',
        sa.Column('auth_user_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    try:
        if not _column_exists('users', 'auth_user_id_idx'):
            op.create_index('ix_users_auth_user_id', 'users', ['auth_user_id'], unique=True)
    except Exception:
        pass

    _add_column_if_missing(
        'users',
        sa.Column('email', sa.String(length=255), nullable=True)
    )
    try:
        if not _column_exists('users', 'ix_users_email'):
            op.create_index('ix_users_email', 'users', ['email'], unique=True)
    except Exception:
        pass

    _add_column_if_missing(
        'users',
        sa.Column('ghana_card_number', sa.String(length=20), nullable=True)
    )
    _add_column_if_missing(
        'users',
        sa.Column('ghana_card_image_url', sa.String(length=500), nullable=True)
    )
    _add_column_if_missing(
        'users',
        sa.Column('credit_score', sa.Integer(), nullable=True, server_default='0')
    )
    _add_column_if_missing(
        'users',
        sa.Column('total_contributed', sa.DECIMAL(precision=15, scale=2), nullable=True, server_default='0')
    )
    _add_column_if_missing(
        'users',
        sa.Column('groups_count', sa.Integer(), nullable=True, server_default='0')
    )


def downgrade() -> None:
    # Intentionally a no-op: these columns are required by current model code and
    # removing them would break existing deployments.
    pass
