"""Contribution and Transaction models."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, DECIMAL, ForeignKey, Index, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Contribution(Base):
    __tablename__ = "contributions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    amount = Column(DECIMAL(15, 2), nullable=False)
    method = Column(String(20), default="momo")  # momo, bank, diaspora, agent_cash
    transaction_ref = Column(String(100), unique=True, nullable=True)
    status = Column(String(20), default="pending")  # pending, completed, failed, refunded
    momo_transaction_id = Column(String(100), nullable=True)
    metadata = Column(JSON, default=dict)  # extra data like diaspora sender info
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    group = relationship("Group", back_populates="contributions")
    user = relationship("User", back_populates="contributions")

    __table_args__ = (
        Index("idx_contrib_group", "group_id"),
        Index("idx_contrib_user", "user_id"),
        Index("idx_contrib_status", "status"),
        Index("idx_contrib_ref", "transaction_ref"),
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type = Column(String(20), nullable=False)  # contribution, withdrawal, loan_disbursement, loan_repayment, insurance_premium, merchant_payment
    reference = Column(String(100), unique=True, nullable=False)
    amount = Column(DECIMAL(15, 2), nullable=False)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    target_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="pending")
    external_ref = Column(String(100), nullable=True)
    metadata = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        Index("idx_txn_type", "type"),
        Index("idx_txn_group", "group_id"),
        Index("idx_txn_user", "user_id"),
        Index("idx_txn_created", "created_at"),
    )
