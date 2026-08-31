"""CreditProfile and Loan models."""
import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Text, Integer, DateTime, DECIMAL, ForeignKey, Index, Boolean, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class CreditProfile(Base):
    __tablename__ = "credit_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    score = Column(Integer, default=0)  # 0-1000
    consistency_rating = Column(DECIMAL(3, 2), default=0)  # 0.00-1.00
    total_contributed_all_time = Column(DECIMAL(15, 2), default=0)
    active_groups = Column(Integer, default=0)
    loan_eligible = Column(Boolean, default=False)
    max_loan_amount = Column(DECIMAL(15, 2), default=0)
    total_loans_taken = Column(Integer, default=0)
    total_loans_repaid = Column(Integer, default=0)
    default_rate = Column(DECIMAL(5, 2), default=0)
    last_calculated_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="credit_profile")


class Loan(Base):
    __tablename__ = "loans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=True)
    amount = Column(DECIMAL(15, 2), nullable=False)
    interest_rate = Column(DECIMAL(5, 2), default=5.00)  # monthly %
    status = Column(String(20), default="applied")  # applied, approved, disbursed, repaying, repaid, defaulted
    purpose = Column(Text, nullable=True)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    disbursed_at = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(Date, nullable=True)
    repaid_at = Column(DateTime(timezone=True), nullable=True)
    total_repayable = Column(DECIMAL(15, 2), nullable=True)
    amount_repaid = Column(DECIMAL(15, 2), default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="loans", foreign_keys=[user_id])
    group = relationship("Group", back_populates="loans")

    __table_args__ = (
        Index("idx_loans_user", "user_id"),
        Index("idx_loans_status", "status"),
    )
