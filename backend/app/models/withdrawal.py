"""Withdrawal and WithdrawalApproval models."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, DateTime, DECIMAL, ForeignKey, Index, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Withdrawal(Base):
    __tablename__ = "withdrawals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False)
    requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    amount = Column(DECIMAL(15, 2), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(20), default="pending")
    # pending -> approved -> agent_pending -> verified -> completed
    # or any state -> rejected
    approval_count = Column(Integer, default=0)
    approval_required = Column(Integer, default=1)
    required_approvals_config = Column(Text, nullable=True)  # JSON representation of rules
    expires_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    agent_id = Column(String(50), nullable=True)  # MoMo agent ID
    agent_verified_at = Column(DateTime(timezone=True), nullable=True)
    disbursed_at = Column(DateTime(timezone=True), nullable=True)
    momo_disbursement_ref = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    group = relationship("Group", back_populates="withdrawals")
    requester = relationship("User", back_populates="withdrawals_requested", foreign_keys=[requested_by])
    approvals = relationship("WithdrawalApproval", back_populates="withdrawal", cascade="all, delete-orphan")
    agent_verification = relationship("AgentVerification", back_populates="withdrawal", uselist=False)

    __table_args__ = (
        Index("idx_withdraw_group", "group_id"),
        Index("idx_withdraw_status", "status"),
    )


class WithdrawalApproval(Base):
    __tablename__ = "withdrawal_approvals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    withdrawal_id = Column(UUID(as_uuid=True), ForeignKey("withdrawals.id", ondelete="CASCADE"), nullable=False)
    member_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    approved = Column(Boolean, nullable=False)
    channel = Column(String(20), default="pwa")  # pwa, ussd, whatsapp
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    withdrawal = relationship("Withdrawal", back_populates="approvals")
