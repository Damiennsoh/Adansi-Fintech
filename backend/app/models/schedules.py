"""ContributionSchedule and GroupMonthlySummary models."""
import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Integer, DateTime, DECIMAL, ForeignKey, Date, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class ContributionSchedule(Base):
    __tablename__ = "contribution_schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    expected_date = Column(Date, nullable=False)
    expected_amount = Column(DECIMAL(12, 2), nullable=False)
    status = Column(String(20), default="pending")  # pending, paid, late, missed
    paid_at = Column(DateTime(timezone=True), nullable=True)
    contribution_id = Column(UUID(as_uuid=True), ForeignKey("contributions.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class GroupMonthlySummary(Base):
    __tablename__ = "group_monthly_summaries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    total_contributions = Column(DECIMAL(12, 2), default=0)
    total_withdrawals = Column(DECIMAL(12, 2), default=0)
    member_count = Column(Integer, default=0)
    contribution_count = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("group_id", "year", "month", name="uq_group_year_month"),
    )
