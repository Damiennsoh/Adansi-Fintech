# Adansi Feature Documentation

## 1. What Adansi is

Adansi is a Ghana-focused, USSD-first group finance platform for organizing and accounting for collective contributions. It is designed for funeral funds, wedding funds, health groups, family savings circles, susu groups, and other trusted communities that collect money toward a shared purpose.

Adansi provides the software layer around a group’s financial coordination:

- group creation and membership;
- contribution schedules and payment records;
- transparent transaction history;
- multi-person approval for withdrawals;
- direct beneficiary disbursement workflows;
- contribution-based social credit signals;
- phone-friendly and diaspora participation paths.

Adansi is **not a bank**, does not independently hold deposits, and does not currently promise interest or insurance products.

## 2. The problem Adansi is meant to solve

Collective finance is common in Ghana, but many groups still depend on notebooks, spreadsheets, phone calls, and one person’s personal wallet or bank account. That creates several problems:

- members cannot easily prove who paid and when;
- treasurers can become a single point of control;
- contributors forget deadlines;
- diaspora members have difficulty contributing conveniently;
- feature-phone users can be excluded;
- withdrawals are difficult to approve and audit;
- consistent contribution behavior does not produce useful financial history.

Adansi turns these informal processes into a shared, visible workflow without removing the community structure that makes group finance work.

## 3. Product principles

### Transparency over trust-by-assumption

Every contribution, approval, withdrawal, and relevant status change should be recorded in an auditable ledger that authorized group members can understand.

### No single-person control of group funds

A withdrawal should require the configured number of authorized signatories. The treasurer can initiate a request, but should not be able to unilaterally release group funds.

### Access on any phone

The product is designed for smartphones and a USSD path so that lack of data, hardware, or a banking app does not automatically exclude a member.

### Honest custody messaging

For the MVP, Adansi is a software and ledger layer. If a payment provider is connected, funds are handled through that provider’s regulated merchant infrastructure. In sandbox mode, transactions are demonstrations only and no money moves.

### Build trust before adding financial complexity

The first priority is reliable records, group governance, and understandable workflows. Credit, insurance, marketplace, and wallet features should be introduced only with appropriate partners, controls, and regulatory review.

## 4. Current MVP capabilities

### Authentication and onboarding

- Supabase phone OTP authentication.
- Ghana phone-number normalization.
- New-user profile setup after verification.
- Returning-user PIN flow where configured.
- Clear separation between OTP login and PIN login.

### Group management

- Create a group for a defined purpose.
- Configure contribution amount and frequency.
- Invite or add members.
- Join groups using a group code or invitation path.
- Display group status, type, schedule, and member count.

### Contributions

- Record a contribution against a group and member.
- Preserve transaction references and provider metadata.
- Support sandbox/demo payment flows while Hubtel onboarding is pending.
- Display contribution status and contribution history.
- Provide a guest contribution link where a group intentionally allows public contributions.

### Ledger and history

- Track contributions and withdrawals.
- Show group-level history to authorized members.
- Preserve audit events for important state changes.
- Support idempotent transaction references to reduce duplicate processing risk.

### Withdrawals and approvals

- Create a withdrawal request for an approved purpose and beneficiary.
- Require configured multi-signatory approval.
- Track pending, approved, rejected, and completed states.
- Model direct beneficiary disbursement rather than cash handed to a single treasurer.

### Social credit signals

- Use recorded contribution behavior as a social-finance signal.
- Reward consistency and on-time participation.
- Treat the score as an internal product signal, not a regulated credit decision or guaranteed loan approval.

### USSD and diaspora pathways

- Provide a feature-phone-oriented USSD workflow.
- Support diaspora contribution intent and major foreign-currency display/conversion workflows.
- Keep the ledger denominated and reconciled in the group’s configured currency.

### Sandbox provider behavior

Until the business is registered and Hubtel credentials are available:

- Supabase authentication and database persistence can remain real.
- Hubtel collection and disbursement should remain disabled or explicitly sandboxed.
- Demo transactions must be labelled as sandbox/demo transactions.
- No UI should imply that real money was collected or disbursed.
- Twilio or WhatsApp notifications should be treated as unavailable until credentials are configured.

## 5. Custody and regulatory position

Adansi does not claim to be a bank or deposit-taking institution.

### MVP position

The intended live MVP model is a software layer using a licensed payment provider’s merchant infrastructure, with Adansi’s database tracking group ownership and transaction history. This requires proper provider onboarding, business registration, KYC, terms, reconciliation, and legal review before live money is accepted.

### Phase 2 custody model

Adansi should partner with a licensed rural bank or other suitable regulated financial institution. Each group can then have a real savings or custody account at the partner institution while Adansi remains the software, governance, ledger, and user-experience layer.

### Future MTN-aligned model

A deeper partnership could provide group-level wallets, tagged collection accounts, or sub-merchant containers inside regulated payment infrastructure. This is a partnership roadmap item, not a current product claim.

## 6. Phase 2 roadmap — future features yet to be built

Phase 2 begins after the MVP workflows are stable, the business is properly registered, and regulated/payment partners are available.

### 6.1 Licensed custody partnership

- Partner-bank account creation for eligible groups.
- Separate group balances held by the regulated partner.
- Reconciliation between partner statements and Adansi’s ledger.
- Settlement, dispute, refund, and chargeback workflows.
- Clear custody disclosures and customer support procedures.

### 6.2 Production Hubtel and MTN payment integration

- Production merchant onboarding.
- Real collection and disbursement APIs.
- Signed and verified provider callbacks.
- Idempotent payment processing.
- Provider reconciliation and failed-payment recovery.
- Group-specific references, tagged collections, or sub-merchant accounts where supported.

### 6.3 Automated recurring contributions

- Member opt-in recurring collection schedules.
- Due-date reminders and grace periods.
- Retry handling for failed collections.
- Pause, cancel, and consent history.
- Clear fees and notification before collection.

### 6.4 Expanded notifications

- Production SMS notifications.
- WhatsApp notifications and receipts.
- Contribution due reminders.
- Approval and withdrawal alerts.
- Failed-payment and reversal notifications.
- Notification preferences and delivery history.

### 6.5 Agent Guardian Network

- Agent-assisted identity verification.
- Stronger checks for large or unusual withdrawals.
- Biometric or approved identity-provider integration where legally and technically supported.
- Agent settlement and escalation workflows.
- Fraud monitoring and suspicious-activity review.

### 6.6 Embedded micro-insurance

- Licensed insurer partnerships.
- Funeral, wedding, health, or event-related cover options.
- Policy quotes, consent, premium collection, and claims status.
- Product disclosures that clearly separate insurance from group savings.
- No insurance product should be marketed before the required partner and approvals exist.

### 6.7 Group marketplace

- Offers for coffins, catering, textbooks, medical supplies, and other group needs.
- Verified merchant onboarding.
- Quote comparison and group approval.
- Order, delivery, refund, and dispute tracking.
- Commission disclosure and conflict-of-interest controls.

### 6.8 Stronger social credit and financial inclusion

- More robust payment-history features.
- Consent-based data sharing with lending partners.
- Explainable score factors.
- Member dispute and correction process.
- No automated adverse decision without appropriate review and compliance controls.

### 6.9 Group governance and controls

- Configurable roles such as founder, treasurer, secretary, and auditor.
- Quorum rules and approval thresholds.
- Member voting for major expenses.
- Beneficiary verification.
- Exportable statements and accountant/auditor access.
- Immutable audit exports for dispute resolution.

### 6.10 Accessibility and distribution

- Improved low-bandwidth mode.
- Local-language guidance where practical.
- Assisted onboarding through approved agents or community partners.
- Better USSD coverage and recovery for interrupted sessions.
- Accessible text sizing, contrast, and screen-reader support.

## 7. Out of scope until Phase 2 or later

The following should not be represented as live MVP capabilities:

- interest-bearing savings;
- Adansi-issued loans;
- Adansi-held deposits outside a properly approved partner model;
- dedicated MTN group wallets without MTN support;
- live insurance policies;
- live SMS or WhatsApp delivery without provider credentials;
- production payment collection without Hubtel/provider onboarding;
- guaranteed credit approval based only on the Adansi score.

## 8. Success measures

The MVP should be evaluated on whether groups can:

1. onboard members;
2. create a group with a clear purpose and schedule;
3. record contributions without ambiguity;
4. see an understandable ledger;
5. approve withdrawals collectively;
6. identify the intended beneficiary;
7. use the product from a phone;
8. distinguish demo transactions from real financial activity.

Phase 2 should add regulated custody, production payment reliability, stronger fraud controls, and partner-backed financial products—not simply more screens.

## 9. Deployment and environment summary

The current architecture is:

- Frontend: Vite + React PWA, deployed on Vercel.
- Backend: FastAPI + SQLAlchemy async, deployed on Render.
- Authentication: Supabase Auth.
- Database: Supabase PostgreSQL.
- Cache/session support: Upstash Redis-compatible service.
- Intended payment provider: Hubtel, pending business registration and provider onboarding.
- Optional notifications: Twilio/WhatsApp, pending credentials.

Production deployments must keep secrets in environment variables, configure the public backend URL for provider callbacks, and use explicit sandbox/live configuration. Never commit provider secrets or service-role keys to the repository.

## 10. Product language to use

Prefer:

- “group treasury software”;
- “shared contribution ledger”;
- “multi-signatory approval”;
- “sandbox transaction”;
- “pending provider onboarding”;
- “partner-held funds” when a regulated custody partner exists.

Avoid:

- “Adansi bank”;
- “your money is insured” without a licensed insurance product;
- “guaranteed loan”;
- “interest earned” in the MVP;
- “real payment completed” for a sandbox transaction.
