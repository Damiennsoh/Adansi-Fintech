# Adansi Guest Contribution and Product Architecture Notes

## 1) One-page PR description

Title:
Adansi: unify app flow and add guest public contribution link

Summary:
This PR simplifies the product architecture by removing the redundant diaspora-only app experience and introducing a guest public contribution flow for one-time payers. The app now follows a cleaner structure: one shared app for authenticated users, with phone or email sign-in depending on user type, and a public group contribution page for guests who do not want to create an account.

What changed:
- Removed the redundant Diaspora tab and separated app route from the core app experience
- Kept the product unified for all authenticated users
- Added a group-level "Share public link" action
- Added a public guest contribution page at /g/:code
- Guest checkout includes group name, code, target info, payer name, and payment method selection
- Guest contributions are recorded against the group audit and activity without creating a group membership
- Email sign-in remains available for diaspora users inside the main app
- Phone/PIN and OTP remain the default for Ghana users

Why:
The previous design split the product in a way that confused users and duplicated the experience. This change makes the product clearer and more scalable:
- full users use the same app
- one-time guest payers use a public contribution page
- group-specific public links make it obvious which group is being funded

Risk:
Low-to-moderate. Main risks are product validation, provider configuration, and ensuring guest contributions do not accidentally create membership or permission states. These are addressed by the restricted guest-flow design and targeted audit logging.

Verification:
- Frontend production build passed
- Backend syntax validation passed
- Guest flow is committed and pushed

---

## 2) Production environment checklist

### Application
- [ ] Frontend base URL is configured correctly for production
- [ ] Backend API base URL is configured correctly
- [ ] All protected routes still redirect correctly
- [ ] Public guest route works on production domain
- [ ] App loads with HTTPS enabled
- [ ] Browser caching and service worker config is acceptable for production

### Auth
- [ ] Supabase auth is configured for email/phone flows
- [ ] Local JWT config is valid
- [ ] Refresh token flow works in production
- [ ] Phone auth remains available for Ghana users
- [ ] Email auth remains available for diaspora users
- [ ] Session expiry and redirect behavior works correctly

### Payment providers
- [ ] Hubtel / MoMo credentials are configured
- [ ] Card payment provider is configured
- [ ] Public guest card flow is enabled
- [ ] Payment webhooks are configured and reachable
- [ ] Callback URLs are whitelisted
- [ ] Payment failure and retry behavior is monitored

### File and data config
- [ ] Database URL is valid
- [ ] Group code generation remains unique
- [ ] Guest contribution metadata is persisted correctly
- [ ] Audit events include group_id, amount, payer name, and method
- [ ] Guest contributions do not create membership rows
- [ ] Reconciliation logic runs after guest contribution settlement

### Security
- [ ] CORS is limited to approved origins
- [ ] Public guest checkout does not expose privileged routes
- [ ] Public links do not create account sessions
- [ ] Sensitive secrets are not exposed in frontend bundles
- [ ] JWT secrets are stored in secure environment variables

### Monitoring and alerts
- [ ] Payment webhook failures are monitored
- [ ] Guest contribution errors are logged
- [ ] Group balance mismatch checks are monitored
- [ ] API errors are tracked in production logs
- [ ] Frontend errors and analytics are enabled

### QA
- [ ] Guest group link opens correctly
- [ ] Group name and code are visible on guest page
- [ ] Guest contribution updates group activity
- [ ] Guest contribution does not create member membership
- [ ] Mobile view works on smaller screens
- [ ] Payment success and failure states are clear

---

## 3) QA test cases for guest contributions

### Guest link creation
1. Create a group
2. Open group detail page
3. Click "Share public link"
4. Confirm link is copied to clipboard
5. Confirm URL contains the group code
6. Confirm URL contains the correct group name in the payload or metadata
7. Confirm link opens the public guest page

### Guest page rendering
8. Open guest URL in incognito browser
9. Confirm guest page loads without login
10. Confirm exact group name displays
11. Confirm exact group code displays
12. Confirm target amount displays
13. Confirm no member dashboard or protected app nav appears
14. Confirm no member account is created after submission

### Guest contribution submission
15. Enter amount greater than zero
16. Enter payer name
17. Select card payment
18. Submit contribution
19. Confirm success message appears
20. Confirm record is added to the group activity log
21. Confirm guest contribution appears in audit/event feed
22. Confirm group balance increases correctly
23. Confirm no membership row is added for the guest
24. Repeat with MoMo option for Ghana-based guest user

### Negative cases
25. Submit with empty amount -> validation error
26. Submit with zero amount -> block
27. Use invalid group code -> show invalid group page
28. Use expired or deleted group -> show friendly error
29. Submit while offline -> show retry-friendly error
30. Submit with duplicate or malformed payload -> fail gracefully

### Permission and identity rules
31. Guest payer should not see admin actions
32. Guest payer should not be able to withdraw
33. Guest payer should not appear in the normal member list
34. Group admin should still see the guest contribution in activity/audit
35. Group balance and target amount should reconcile properly after guest payments

### Mobile checks
36. Submit from small mobile viewport
37. Confirm share button is visible and tappable
38. Confirm keyboard doesn’t cover form fields
39. Confirm payment flow remains clear on narrow screens
40. Confirm CTA buttons remain readable and not clipped

---

## 4) Executive summary for business stakeholders

Adansi now has a clearer product structure and a safer one-time contribution flow.

Instead of creating a separate diaspora app experience, we kept one unified app for all users. Ghana users continue to use phone-based login and MoMo, while diaspora users can use email-based sign-in in the same app. For people who only want to contribute once without creating an account, we added a public group contribution link.

This reduces confusion, keeps the app simpler, and supports a broader user base without creating duplicate product experiences. It also improves trust because the public link is tied directly to a real group, displays the correct group name and code, and records the payer in the group activity without turning them into a full member.

---

## 5) Product architecture summary

The clean final design is:

- Local users: phone auth + MoMo + full app access
- Diaspora users: email auth + same app + card payment
- Guest contributors: no account + public contribution link + one-time payment

This is the final architecture we are implementing and validating.

---

## 6) Verified implementation status

Validated:
- Frontend production build passed
- Backend syntax check passed
- Guest public contribution flow committed and pushed to the remote repository

Current architecture rule:
- The guest contribution link is the only separate public path
- Regular diaspora users are not treated as a separate product segment within the app
- Guests do not become members unless they explicitly choose to sign up and join the group

---

## 7) Notes for future product work

Remaining production follow-up items:
- real card payment provider wiring in production
- real MoMo callback validation in production
- full webhook monitoring and retry policy
- QA against live environment
- final group-level reward and audit validation

This should be used as the reference document for the public guest contribution feature and the final simplified app architecture.
