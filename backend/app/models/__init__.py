"""Import all models so Base.metadata knows about them."""
from app.models.user import User
from app.models.group import Group, GroupMember
from app.models.contribution import Contribution, Transaction
from app.models.withdrawal import Withdrawal, WithdrawalApproval
from app.models.credit import CreditProfile, Loan
from app.models.agent import AgentVerification, InsurancePolicy
from app.models.notification import Notification, UssdSession
from app.models.mvp import GroupJoinRequest, AuditEvent, ExchangeRateQuote

__all__ = [
    "User", "Group", "GroupMember",
    "Contribution", "Transaction",
    "Withdrawal", "WithdrawalApproval",
    "CreditProfile", "Loan",
    "AgentVerification", "InsurancePolicy",
    "Notification", "UssdSession",
    "GroupJoinRequest", "AuditEvent", "ExchangeRateQuote"
]
