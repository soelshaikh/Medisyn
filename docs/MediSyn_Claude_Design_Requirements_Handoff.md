# MediSyn — UX/UI Design Requirements & Claude Handoff

## Purpose
This is the working design brief for Claude. Use it as the source of truth for UX/UI exploration. Do not invent business rules. Separate **Confirmed Requirements**, **Proposed UX/Design Decisions**, and **Open Questions**.

Primary source: the MediSyn client proposal supplied in this conversation.  
Public content/IA reference: Quiick Medicine (`https://quiickmedicine.ca/`).

## Critical instruction
- Do not jump directly into random screens.
- First analyze requirements and IA.
- Do not silently invent features, workflows, medical claims, legal/compliance promises, or business rules.
- Use Quiick as a content/reference source, not a visual clone.
- Keep public navigation simple and patient-task oriented.
- Design for Canadian healthcare context and accessibility from the beginning.

## Recommended public header
**Compounding | Prescription ▾ | Minor Ailment | How It Works | Services ▾ | Dashboard | Shop Now | Search | Account | Cart**

### Prescription dropdown
- Transfer Prescription
- Refill Prescription
- New Prescription
- Custom Formulation can be surfaced in this area or on the Compounding experience.

### Services dropdown
- Vaccines
- Ask a Pharmacist
- Other confirmed pharmacy services

Do not make About, Contact, FAQ, Privacy, Terms, Blog/News primary navigation items unless MediSyn later confirms otherwise.

## Confirmed product requirements
### Patient
- Direct registration
- Email/OTP verification
- Login
- Password reset
- Profile
- Prescription Transfer
- Prescription Refill
- New Prescription
- Custom Formulation Request
- Ask a Pharmacist
- Minor Ailment services/requests
- Vaccine request in MVP1
- Slot-based vaccine booking as MVP2 option
- Shopping/cart/wishlist/coupons if shopping is confirmed
- Request/order status where included in selected scope

### Clinic
- Registration/request access
- MediSyn approval before portal access
- Approval/rejection/suspension/deactivation by Admin
- Exact clinic fields and detailed portal capabilities remain open

### Pharmacy Partner
- Registration/request access
- MediSyn approval before portal access
- Approval/rejection/suspension/deactivation by Admin
- Exact pharmacy fields and detailed portal capabilities remain open

### Admin
- User management
- Clinic/pharmacy approval
- Prescription management
- Ask a Pharmacist management
- Vaccine request/booking management
- Product/inventory management if shopping is included
- Coupon management if shopping is included
- FAQ/policy management
- Pharmacy/website settings
- Activity tracking where required

## MVP
### MVP1
Modern responsive website; patient registration/authentication; clinic/pharmacy approval; core admin; prescription workflows; Ask a Pharmacist; Minor Ailments; simple vaccine appointment request; shopping if confirmed; basic cart/wishlist/coupons if confirmed; privacy/security foundation.

### MVP2
Dynamic website/pharmacy settings; dynamic FAQ/policy/menu/shipping; Minor Ailment toggles; slot-based vaccine booking; appointment automation; advanced coupons; dynamic product/inventory; request status tracking; enhanced messaging; notifications; expanded permissions/audit.

### MVP3
Integrations such as MedEssist subject to validation; advanced workflows; delivery/order tracking; refill reminders; document management; analytics; personalized dashboards; APIs; advanced automation/AI only after privacy/compliance review.

## Core user flows
1. Registration → verification → login → dashboard
2. Login → password reset
3. Refill
4. Transfer
5. New prescription
6. Custom formulation
7. Ask a Pharmacist
8. Minor Ailment request
9. Vaccine request MVP1
10. Vaccine slot booking MVP2
11. Shop → product → cart → coupon → checkout/order confirmation, if confirmed
12. Wishlist
13. Clinic registration → pending → admin review → approval/rejection → notification
14. Pharmacy registration → pending → admin review → approval/rejection → notification
15. Admin prescription/request management
16. Admin appointment management
17. Admin product/coupon management

## Patient dashboard direction
The dashboard should be task-oriented:
- Refill Prescription
- Transfer Prescription
- New Prescription
- Custom Formulation
- Ask a Pharmacist
- Book Vaccine
- Upcoming appointments
- Prescription/request status
- Recent orders
- Important messages
- Profile/settings

## Accessibility
Target WCAG 2.2 AA-level quality. Consider applicable Ontario AODA requirements.
- Contrast
- Visible focus
- Keyboard navigation
- Semantic headings/landmarks
- Persistent labels
- Accessible validation/errors
- Accessible OTP/authentication
- Accessible dialogs
- Comfortable touch targets
- Text resizing
- Screen-reader names for icon controls
- No colour-only communication
- Predictable navigation
- Plain language
- Recovery from expiring OTPs

## Visual direction
- Modern, clean, premium, trustworthy, Canadian, human, calm, professional.
- Primary: sophisticated healthcare blue.
- Accent: warm yellow, used sparingly.
- Neutral: white/off-white/light cool gray.
- Text: dark charcoal/navy.
- Semantic colours: distinct success/warning/error/info.
- Avoid generic pharmacy template, government aesthetic, childish styling, excessive clinical imagery, SaaS gimmicks, and visual noise.
- One dominant action per screen.
- Generous whitespace.
- Consistent iconography.
- Human, credible imagery used sparingly.

Suggested starting tokens only; final values require contrast/brand validation:
- Blue: around #0B6FA4–#1677A8
- Yellow: around #F2C14E
- White: #FFFFFF
- Dark text: charcoal/navy
- Soft surface: very light blue/gray

## Quiick Medicine content reference
Use the current Quiick website to understand content topics and patient-facing structure:
- Compounding
- Prescription services
- Minor Ailments
- Vaccines
- Ask a Pharmacist
- How it works
- OTC / health products
- FAQs
- Delivery
- Pharmacy trust information

Rewrite for MediSyn. Do not copy Quiick brand claims, contact information, accreditation, pricing, or wording unless separately confirmed.

## Open questions — never assume
- Exact patient registration fields
- Dependents/family accounts
- Account requirement for doctor-direct prescriptions
- Prescription file types/sizes
- Patient-visible prescription statuses
- Minor Ailment service list
- Vaccine list and eligibility
- Appointment duration/capacity/cancellation/rescheduling
- Whether shopping is MVP1
- Product restrictions
- Provincial shipping rules
- Payment gateway
- Refund/cancellation policy
- Coupon rules
- Admin roles/permissions
- Who can view PHI/prescription files
- Dynamic content scope
- Existing pharmacy management systems
- Data retention/storage requirements
- Final privacy/security/compliance requirements

## Research references
- Quiick Medicine: https://quiickmedicine.ca/
- Quiick login: https://quiickmedicine.ca/login/
- Quiick shop: https://quiickmedicine.ca/shopnow/
- Quiick how it works: https://quiickmedicine.ca/howitwork/
- Quiick FAQs: https://quiickmedicine.ca/faqs/
- Health Canada online pharmacy safety: https://www.canada.ca/en/health-canada/topics/buying-using-drug-health-products-safely/safe-use-online-pharmacies.html
- Ontario accessibility guidance: https://www.ontario.ca/page/how-make-websites-accessible
- Ontario provider access to drug/pharmacy information: https://www.ontario.ca/page/health-care-provider-access-drug-and-pharmacy-service-information
- WCAG 2.2: https://www.w3.org/TR/WCAG22/

## Expected output from Claude
1. Requirements analysis: Confirmed / Proposed / Open Questions
2. Sitemap and navigation
3. Ecosystem IA
4. Detailed MVP1 user flows
5. Screen/page inventory
6. Responsive/mobile strategy
7. Accessible design system
8. Component inventory for frontend
9. MediSyn content hierarchy using Quiick as reference
10. MVP roadmap/dependencies
11. Explicit assumptions requiring confirmation
12. Only then, high-fidelity UI direction

## Design North Star
**Make MediSyn feel like a trusted Canadian pharmacy that is as easy to use online as speaking to a helpful pharmacist in person.**
