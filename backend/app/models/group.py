"""Group and GroupMember models."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime, DECIMAL, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Group(Base):
    __tablename__ = "groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(150), nullable=False)
    code = Column(String(10), unique=True, nullable=False, index=True)
    type = Column(String(30), nullable=False, index=True)  # funeral, wedding, susu, school, health, investment
    purpose = Column(Text, nullable=True)
    target_amount = Column(DECIMAL(15, 2), nullable=True)
    current_balance = Column(DECIMAL(15, 2), default=0)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default="active")  # active, paused, completed, dissolved
    withdrawal_threshold = Column(DECIMAL(15, 2), default=500.00)
    agent_verification_required = Column(Boolean, default=True)
    contribution_frequency = Column(String(20), nullable=True)  # daily, weekly, monthly, adhoc
    contribution_amount = Column(DECIMAL(10, 2), nullable=True)
    auto_insurance_enabled = Column(Boolean, default=False)
    approval_rule = Column(String(30), default="any_1_treasurer", nullable=False)
    auto_approve_limit = Column(DECIMAL(15, 2), default=0, nullable=False)
    approval_timeout_hours = Column(Integer, default=24, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    members = relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")
    contributions = relationship("Contribution", back_populates="group")
    withdrawals = relationship("Withdrawal", back_populates="group")
    loans = relationship("Loan", back_populates="group")
    insurance_policies = relationship("InsurancePolicy", back_populates="group")


class GroupMember(Base):
    __tablename__ = "group_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), default="member")  # admin, treasurer, member
    joined_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    contribution_streak = Column(Integer, default=0)
    total_contributed = Column(DECIMAL(15, 2), default=0)
    last_contribution_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    group = relationship("Group", back_populates="members")
    user = relationship("User", back_populates="memberships")

    __table_args__ = (
        Index("idx_gm_group", "group_id"),
        Index("idx_gm_user", "user_id"),
    )
