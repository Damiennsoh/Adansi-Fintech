"""Add rotation_queue and rotation_enabled columns to groups table

Revision ID: 001_add_rotation_columns
Revises: 
Create Date: 2026-09-01 03:42:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_add_rotation_columns'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add rotation_queue column (JSONB type)
    op.add_column('groups', sa.Column('rotation_queue', postgresql.JSONB(), nullable=True, server_default='[]'))
    
    # Add rotation_enabled column (Boolean type)
    op.add_column('groups', sa.Column('rotation_enabled', sa.Boolean(), nullable=True, server_default='false'))


def downgrade() -> None:
    # Remove rotation_queue column
    op.drop_column('groups', 'rotation_queue')
    
    # Remove rotation_enabled column
    op.drop_column('groups', 'rotation_enabled')
