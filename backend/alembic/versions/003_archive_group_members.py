"""Add archival state to group memberships."""
from alembic import op
import sqlalchemy as sa

revision = "003_archive_group_members"
down_revision = "002_add_users_email_and_missing_columns"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("group_members", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("group_members", "archived_at")
