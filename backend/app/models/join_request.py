"""JoinRequest model for admin approval of group membership requests."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class JoinRequest(Base):
    __tablename__ = "join_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="pending")  # pending, approved, rejected
    requested_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    responded_at = Column(DateTime(timezone=True), nullable=True)
    responded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    group = relationship("Group", foreign_keys=[group_id])
    user = relationship("User", foreign_keys=[user_id])
    responder = relationship("User", foreign_keys=[responded_by])

    __table_args__ = (
        Index("idx_join_req_group", "group_id"),
        Index("idx_join_req_user", "user_id"),
        Index("idx_join_req_status", "status"),
    )
