"""User model with credit scoring fields."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Integer, DateTime, DECIMAL, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth_user_id = Column(UUID(as_uuid=True), unique=True, nullable=True, index=True)
    phone = Column(String(15), unique=True, nullable=False, index=True)
    ghana_card_number = Column(String(20), unique=True, nullable=True)
    ghana_card_image_url = Column(String(500), nullable=True)
    full_name = Column(String(100), nullable=False)
    pin_hash = Column(String(255), nullable=True)  # bcrypt hashed
    role = Column(String(20), default="user", nullable=False)  # user, agent, admin, super_admin
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    credit_score = Column(Integer, default=0)
    total_contributed = Column(DECIMAL(15, 2), default=0)
    groups_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    memberships = relationship("GroupMember", back_populates="user", cascade="all, delete-orphan")
    contributions = relationship("Contribution", back_populates="user")
    withdrawals_requested = relationship("Withdrawal", back_populates="requester", foreign_keys="Withdrawal.requested_by")
    credit_profile = relationship("CreditProfile", back_populates="user", uselist=False)
    loans = relationship("Loan", back_populates="user", foreign_keys="Loan.user_id")
    notifications = relationship("Notification", back_populates="user")
