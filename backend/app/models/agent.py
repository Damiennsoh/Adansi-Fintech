"""AgentVerification and InsurancePolicy models."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, DECIMAL, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class AgentVerification(Base):
    __tablename__ = "agent_verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    withdrawal_id = Column(UUID(as_uuid=True), ForeignKey("withdrawals.id"), nullable=False)
    agent_id = Column(String(50), nullable=False)
    agent_name = Column(String(100), nullable=True)
    agent_location = Column(Text, nullable=True)
    ghana_card_verified = Column(Boolean, default=False)
    biometric_verified = Column(Boolean, default=False)
    verification_photo_url = Column(String(500), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    withdrawal = relationship("Withdrawal", back_populates="agent_verification")

    __table_args__ = (
        Index("idx_av_withdrawal", "withdrawal_id"),
    )


class InsurancePolicy(Base):
    __tablename__ = "insurance_policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False)
    provider = Column(String(50), nullable=True)  # enterprise_life, hollard, etc.
    type = Column(String(30), nullable=False)  # funeral, wedding, health, education
    premium = Column(DECIMAL(10, 2), nullable=False)
    coverage_amount = Column(DECIMAL(15, 2), nullable=False)
    status = Column(String(20), default="pending")  # pending, active, expired, claimed
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    auto_deduct = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    group = relationship("Group", back_populates="insurance_policies")
