"""Notification and UssdSession models."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, DateTime, DECIMAL, ForeignKey, Index, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    channel = Column(String(20), nullable=False)  # whatsapp, sms, push, email
    type = Column(String(30), nullable=False)  # contribution, withdrawal_request, approval_needed, credit_update, agent_alert
    content = Column(Text, nullable=False)
    status = Column(String(20), default="pending")  # pending, sent, delivered, failed
    external_message_id = Column(String(100), nullable=True)  # Twilio message SID
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="notifications")

    __table_args__ = (
        Index("idx_notif_user", "user_id"),
        Index("idx_notif_status", "status"),
    )


class UssdSession(Base):
    __tablename__ = "ussd_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(String(100), unique=True, nullable=False)
    phone = Column(String(15), nullable=False)
    current_menu = Column(String(50), default="main")
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=True)
    amount = Column(DECIMAL(15, 2), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    step = Column(Integer, default=1)
    data = Column(JSON, default=dict)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    __table_args__ = (
        Index("idx_ussd_session", "session_id"),
        Index("idx_ussd_phone", "phone"),
    )
