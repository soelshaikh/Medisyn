# MediSyn Website – Proposed Features

The proposed MediSyn platform will consist of **two main portals**, supported by different access and approval flows:

1. **Admin Portal**
2. **Public Website / Patient Portal**

The platform will use different registration and approval rules based on the type of user.

---

## 1. User Access & Approval Model

### 1.1 Patient Account

Patients can create an account directly from the public website.

**Patient flow:**

```text
Patient
  ↓
Register
  ↓
Email Verification / OTP
  ↓
Login
  ↓
Access Patient Portal
```

Patients do **not** require manual MediSyn approval to create a standard patient account, subject to the final registration and privacy requirements confirmed with MediSyn.

### 1.2 Clinic Account

Clinic users will require MediSyn approval before receiving access to clinic-specific portal functionality.

**Clinic flow:**

```text
Clinic
  ↓
Register / Request Access
  ↓
Provide Clinic & Contact Information
  ↓
MediSyn Admin Review
  ↓
Approve / Reject
  ↓
If Approved → Email Notification
  ↓
Clinic Login
```

The Admin Portal will allow MediSyn staff to review, approve, reject, suspend, or deactivate clinic accounts.

### 1.3 Pharmacy / Pharmacy Partner Account

Pharmacy users will also require MediSyn approval before accessing pharmacy-specific functionality.

**Pharmacy flow:**

```text
Pharmacy
  ↓
Register / Request Access
  ↓
Provide Pharmacy & Contact Information
  ↓
MediSyn Admin Review
  ↓
Approve / Reject
  ↓
If Approved → Email Notification
  ↓
Pharmacy Login
```

The Admin Portal will allow MediSyn staff to review and manage pharmacy partner accounts and their access status.

> **Note:** The exact information required during Clinic and Pharmacy registration, and the approval criteria, will be confirmed with MediSyn before implementation.

---

# 2. Admin Portal

The Admin Portal will allow MediSyn staff to manage the website, pharmacy services, products, appointments, prescriptions, users, approvals, and content from a centralized dashboard.

## 2.1 Pharmacy & Website Management

### MVP1 — Initial Configuration

In MVP1, core pharmacy and website information will be configured as part of the initial website setup. These settings will not be fully dynamic through the Admin Portal.

- Configure pharmacy contact information.
- Configure pharmacy opening and closing hours.
- Configure pharmacy holidays and unavailable dates.
- Configure website menu options.
- Configure website maintenance mode, where required.
- Configure initial shipping rules for Ontario and other provinces.
- Configure initial FAQs.
- Configure initial Privacy Policy and Terms & Conditions content.
- Configure Minor Ailment services available at launch.

### MVP2 — Dynamic Admin Management

In MVP2, the above pharmacy and website settings can be managed dynamically through the Admin Portal, without requiring developer changes.

- Add, edit, and update pharmacy contact information.
- Update pharmacy opening and closing hours.
- Add and manage holidays and unavailable dates.
- Enable or disable website menu options.
- Enable or disable website maintenance mode.
- Add and update free-shipping rules for Ontario and other provinces.
- Shipping rule changes will apply to **new orders only** and will not affect historical orders.
- Add, edit, and manage FAQs.
- Add, edit, and update Privacy Policy and Terms & Conditions.
- Enable or disable Minor Ailment services as required.

## 2.2 User & Approval Management

### MVP1 — Core User & Approval Management

Admin can manage different types of platform users:

### Patients

- View registered patients.
- Manage patient account status.
- Activate, suspend, or deactivate accounts where required.
- View relevant patient activity and requests.

### Clinics

- View clinic registration requests.
- Review clinic information.
- Approve or reject clinic registrations.
- Suspend or deactivate approved clinic accounts.
- Manage clinic account status.

### Pharmacies / Pharmacy Partners

- View pharmacy registration requests.
- Review pharmacy information.
- Approve or reject pharmacy registrations.
- Suspend or deactivate approved pharmacy accounts.
- Manage pharmacy account status.

> Approval actions should be recorded with appropriate administrative activity tracking.

## 2.3 Vaccine Appointment Management

### MVP1 — Simple Appointment Request

For the initial release, MediSyn can use a simple appointment request form.

Patients can:

- Select the vaccine/service they are interested in.
- Enter preferred date/time or appointment information.
- Provide required contact details.
- Submit an appointment request.

Admin can:

- View appointment requests.
- Contact the patient.
- Confirm, decline, or update the request status.

### MVP2 — Slot-Based Appointment Booking

If MediSyn wants a more automated booking experience, the platform can be enhanced in MVP2 with:

- Manage available vaccines.
- Create and manage appointment time slots.
- Set available dates and times.
- Set appointment capacity.
- Show available slots to patients in real time.
- Allow patients to select and confirm an available slot.
- Manage booked appointments.
- Update appointment status.
- Prevent overbooking based on configured capacity.

This allows MediSyn to launch with a simpler workflow and introduce automated scheduling once the operational process is confirmed.

## 2.4 Ask a Pharmacist Management

### MVP1 — Basic Request Management

- Manage Ask a Pharmacist requests.
- View patient questions and requests.
- Respond to patient requests.
- Track the status of requests.
- Manage request categories or availability where required.

### MVP2 — Enhanced Messaging & Self-Service

- Support more advanced patient-to-pharmacy communication, where required.
- Provide enhanced request status and notification workflows.

## 2.5 Product & Inventory Management

### MVP1 — Initial Product Setup

- Add and configure initial products.
- Manage initial product information, pricing, categories, and availability.

### MVP2 — Dynamic Product & Inventory Management

- Add, edit, and remove products.
- Manage product information and pricing.
- Manage product inventory/stock. (With Batch wise - and proepr stock management on Order side , selection this item from this stock)
- Update product availability. (Using Batcch wise proepr stock managment)
- Manage product categories.

## 2.6 Coupon Management

### MVP1 — Basic Coupon Configuration

If shopping is included in MVP1:

- Create and manage coupon codes.
- Set percentage-based or fixed-amount discounts.
- Set coupon expiry dates.
- Enable or disable coupons.

### MVP2 — Advanced Coupon Rules

MVP2 can introduce more flexible coupon management through the Admin Portal:

- Set minimum order value conditions, such as a minimum order of **$400**.
- Set maximum discount amounts, where required.
- Set coupon usage limits.
- Set usage limits per customer, where required.
- Define coupon validity periods.
- Enable or disable coupons.
- Configure additional coupon conditions and eligibility rules.

This allows MediSyn to create more flexible promotions without requiring developer changes.

## 2.7 Prescription Management

### MVP1 — Core Prescription Request Management

Admin can manage different types of prescription requests:

### Prescription Transfer

- Manage requests to transfer prescriptions from another pharmacy.
- Review submitted prescription and pharmacy information.
- Update request status.

### Prescription Refill

- Manage refill requests from patients.
- Review submitted information.
- Update request status.

### New Prescription

- Manage requests related to obtaining a new prescription, where applicable.
- Review submitted information.
- Update request status.

### Prescription Upload / Custom Formulation

- Manage uploaded prescription requests where applicable.
- Manage custom formulation requests.
- Track request status.

> **Important workflow decision:** If a doctor sends a prescription directly to MediSyn, MediSyn must confirm whether the patient needs to create a website account or whether the pharmacy can process the prescription without requiring a patient account. This decision will determine the final prescription workflow.

---

# 3. Public Website / Patient Portal

The Public Website will provide patients with a secure and convenient way to access MediSyn's products and pharmacy services.

The website will also provide dedicated entry points for **Patients, Healthcare Providers, Clinics, and Pharmacy Partners**, where applicable.

## 3.1 Secure Registration & Login

### Patients

- Direct patient registration.
- Secure login.
- Email verification or OTP verification.
- Forgot/reset password functionality.
- Manage patient profile information.

### Clinics & Pharmacies

- Registration / request-access flow.
- Organization and contact information.
- Email verification.
- Account remains pending until MediSyn approval.
- Login becomes available after approval.
- Account status notifications.

## 3.2 Online Shopping

Patients can:

- Browse products.
- Search for products.
- Filter and sort products.
- View product details.
- Add products to the shopping cart.
- Update cart quantities dynamically.
- Apply available coupon codes.
- Add products to a wishlist.
- Place orders online.
- We Genrate Automated Invoice (we need to ask about prefix for invoice number) 
    -> also need to take care for invoice managment and report managment


> **Scope:** Online payment and the final online-order workflow should be confirmed with MediSyn before implementation.

## 3.3 Ask a Pharmacist

Patients can:

- Submit questions to a pharmacist.
- Provide relevant information about their request.
- Track the status of their request.
- Receive responses from the pharmacy.

## 3.4 Pharmacy Services

Patients can:

- View available pharmacy services.
- View available Minor Ailment services.
- Access service information.
- Submit requests for applicable services.

Admin will be able to enable or disable applicable services.

## 3.5 Vaccine Appointment

### MVP1 — Appointment Request Form

Patients can:

- Select a vaccine/service.
- Enter preferred appointment information.
- Provide required patient/contact details.
- Submit an appointment request.
- Receive confirmation that the request was received.

The MediSyn team can then review and confirm the appointment manually.

### MVP2 — Online Slot Booking

Patients can:

- View available vaccines.
- Select a preferred date.
- View available time slots.
- Select an available appointment slot.
- Enter required patient information.
- Confirm the appointment.
- Receive appointment confirmation.

The Admin Portal will control available dates, times, capacity, and appointment status.

## 3.6 Prescription Services

Patients can submit prescription-related requests:

### Prescription Transfer

Request to transfer an existing prescription from another pharmacy to MediSyn.

### Prescription Refill

Request a refill for an existing prescription.

### New Prescription

Submit a request related to obtaining a new prescription, where applicable.

### Prescription Upload

Upload prescription documentation where applicable.

### Custom Formulation

Submit a request for a custom formulation where applicable.

Patients should also be able to view the **status of their prescription requests** where status tracking is included in the selected MVP scope.

---

# 4. Privacy, Security & Compliance Approach

Privacy, security, and pharmacy-related compliance should be treated as part of the platform design from MVP1 rather than as a separate feature added later.

All legal and regulatory requirements should be reviewed and confirmed with MediSyn's appropriate legal, pharmacy, privacy, and compliance teams before implementation.

## 4.1 MVP1 — Privacy & Security Foundation

The initial release should include:

- HTTPS across the website and secure areas.
- Secure patient registration and login.
- Email verification or OTP verification.
- Password reset functionality.
- Role-based access for patients, clinics, pharmacies, and administrators.
- Prescription files stored in secure, non-public storage.
- Access to patient information restricted according to user role.
- Patient consent/privacy notices included on relevant intake forms.
- Collection of only the information required for each workflow.
- Secure handling of uploaded prescription documents.
- No payment card data stored directly on the pharmacy website when a third-party payment provider is used.
- Administrative activity tracking where required.
- Privacy Policy and Terms & Conditions displayed on the website.
- Privacy Policy and Terms & Conditions manageable through the Admin Portal, subject to final content approval.

## 4.2 MVP2 — Expanded Privacy & Operational Controls

As the platform introduces more advanced patient and organizational workflows, MVP2 can add:

- More detailed request/order status tracking.
- Secure patient-to-pharmacy messaging, if required.
- More detailed user-role permissions.
- Additional administrative activity/audit tracking.
- Notification workflows for sensitive requests.
- Additional controls around document access and retention.
- Integration-specific privacy and security review.
- Review of third-party vendors and data-processing arrangements.
- Confirmation of where applicable patient data is stored or processed.

## 4.3 MVP3 — Advanced Integrations & Controls

For future enhancements, MVP3 can include:

- Deeper pharmacy-system integrations.
- Advanced role and permission management.
- Expanded audit and activity reporting.
- Advanced document management.
- Integration-level monitoring and security controls.
- Additional automation and administrative tools, subject to MediSyn's operational and compliance requirements.

> **Important:** The platform will be designed to support applicable privacy, security, accessibility, and pharmacy requirements. Final legal and regulatory requirements, including applicable privacy obligations, data-processing arrangements, retention requirements, and pharmacy-specific requirements, must be confirmed with MediSyn's legal, pharmacy, privacy, and compliance teams.

---

# 5. MVP Roadmap & Options

The proposed features can be delivered in stages so MediSyn can choose the level of functionality appropriate for the initial launch.

## MVP1 — Initial Website & Core Operations

Focus: **Launch the new website and establish the core digital workflows.**

### Public Website

- Modern responsive website.
- Patient / Provider / Clinic / Pharmacy entry points as required.
- Service pages.
- Prescription request forms.
- Ask a Pharmacist request form.
- Minor Ailment service information and requests.
- Simple vaccine appointment request form.
- Product browsing, if shopping is confirmed.
- Basic cart/wishlist/coupon functionality, if shopping is confirmed.

### Patient Access

- Direct patient registration.
- Secure login.
- Email verification / OTP.
- Password reset.
- Patient profile.

### Clinic & Pharmacy Access

- Registration / request-access form.
- Email verification.
- Pending approval status.
- Admin approval/rejection.
- Login after approval.

### Admin Portal

- Pharmacy and website settings.
- User management.
- Clinic and Pharmacy approval management.
- Prescription management.
- Ask a Pharmacist management.
- Appointment request management.
- Product and inventory management, if shopping is confirmed.
- Coupon management, if shopping is confirmed.
- FAQ and policy content management.

### Privacy & Security

- HTTPS.
- Secure authentication.
- Role-based access.
- Secure prescription file handling.
- Consent/privacy notices.
- Privacy Policy and Terms & Conditions.
- Basic administrative activity tracking where required.

---

## MVP2 — Automation & Self-Service

Focus: **Reduce manual work and improve the patient experience.**

Potential enhancements:

- Slot-based vaccine appointment booking.
- Real-time appointment availability.
- Appointment capacity management.
- Automated appointment confirmations.
- Prescription/request status tracking.
- Secure pharmacist messaging.
- Patient notification workflows.
- More advanced clinic/pharmacy portal functionality.
- Enhanced order management.
- Additional document-management capabilities.
- Expanded admin permissions and activity tracking.
- Additional privacy/security controls based on operational requirements.

---

## MVP3 — Advanced Platform & Integrations

Focus: **Integrate MediSyn's digital platform more deeply with pharmacy operations.**

Potential enhancements:

- MedEssist or other relevant integration improvements.
- Advanced patient/provider/clinic workflows.
- Delivery/order tracking.
- Refill reminders and notifications.
- Advanced document management.
- Advanced analytics and reporting.
- Personalized dashboards.
- API capabilities.
- AI-assisted administrative tools, subject to MediSyn approval and privacy/compliance review.

> **MVP2 and MVP3 are proposed options. Final scope, priorities, integrations, and timelines will be confirmed with MediSyn after the initial requirements and operational workflows are validated.**

---

# 6. MVP Summary — What Is Included in Each Phase

The MVP roadmap is designed to separate the **core launch requirements** from features that can be introduced later as MediSyn's workflows become more established.

## MVP1 — Core Launch

**Goal:** Launch the new website with secure access and the essential patient, business, and pharmacy workflows.

### Included in MVP1

- Modern responsive public website.
- Patient, Healthcare Provider, Clinic, and Pharmacy Partner entry points.
- Direct patient registration, email/OTP verification, login, and password reset.
- Clinic and Pharmacy Partner registration with MediSyn approval before portal access.
- Core Admin Portal.
- Initial pharmacy and website configuration.
- Core FAQ and policy content.
- Core prescription request workflows:
  - New Prescription
  - Prescription Transfer
  - Prescription Refill
  - Prescription Upload
  - Custom Formulation Request
- Basic Ask a Pharmacist request workflow.
- Minor Ailment service information and requests.
- **Simple vaccine appointment request form** with manual MediSyn confirmation.
- Initial product catalogue and basic shopping functionality, if shopping is confirmed for MVP1.
- Basic coupon functionality, if shopping is confirmed.
- Privacy and security foundation, including secure authentication, role-based access, consent/privacy notices, and secure prescription file handling.

## MVP2 — Dynamic Management & Automation

**Goal:** Reduce manual work and give MediSyn more control through the Admin Portal.

### Included as MVP2 Options

- Dynamic pharmacy contact information and hours management.
- Dynamic holiday and unavailable-date management.
- Dynamic website menu and maintenance-mode controls.
- Dynamic shipping rules.
- Dynamic FAQ management.
- Dynamic Privacy Policy and Terms & Conditions management.
- Enable/disable Minor Ailment services from Admin.
- **Slot-based vaccine appointment booking** with dates, time slots, capacity, and availability.
- Automated appointment confirmations and status updates.
- Advanced coupon conditions, such as minimum order values and usage rules.
- Dynamic product, category, pricing, and inventory management.
- Prescription/request status tracking.
- Enhanced patient-to-pharmacy messaging.
- Patient notifications.
- Enhanced Clinic and Pharmacy Partner portal functionality.
- Expanded permissions and administrative activity tracking.
- Additional privacy, security, document, and operational controls.

## MVP3 — Advanced Integrations & Platform Enhancements

**Goal:** Extend the platform and integrate it more deeply with MediSyn's pharmacy operations.

### Potential MVP3 Enhancements

- MedEssist or other relevant system integrations.
- Advanced patient, provider, clinic, and pharmacy workflows.
- Delivery and order tracking.
- Refill reminders and notifications.
- Advanced document management.
- Advanced analytics and reporting.
- Personalized dashboards.
- API capabilities.
- Advanced automation and AI-assisted administrative tools, subject to MediSyn approval and privacy/compliance review.

> **Important:** MVP2 and MVP3 are proposed options. Final scope and priorities will be confirmed with MediSyn based on operational needs, technical dependencies, and compliance requirements.

---

# 7. Overall Platform Structure

```text
MediSyn Platform
│
├── Public Website
│   ├── Patients
│   ├── Healthcare Providers
│   ├── Clinics
│   └── Pharmacy Partners
│
├── Patient Portal
│   ├── Direct Registration
│   ├── Login & Verification
│   ├── Product Search & Shopping
│   ├── Shopping Cart
│   ├── Wishlist
│   ├── Coupons
│   ├── Ask a Pharmacist
│   ├── Minor Ailments
│   ├── Vaccine Appointment Request / Booking
│   ├── Prescription Transfer
│   ├── Prescription Refill
│   ├── New Prescription Request
│   ├── Prescription Upload
│   └── Custom Formulation Request
│
├── Clinic Portal
│   ├── Registration / Request Access
│   ├── MediSyn Approval
│   └── Clinic-Specific Features
│
├── Pharmacy Partner Portal
│   ├── Registration / Request Access
│   ├── MediSyn Approval
│   └── Pharmacy-Specific Features
│
└── Admin Portal
    ├── Pharmacy & Website Management
    ├── User Management
    ├── Clinic Approval
    ├── Pharmacy Approval
    ├── Products & Inventory
    ├── Coupons
    ├── Vaccine & Appointment Management
    ├── Ask a Pharmacist
    ├── Prescription Management
    ├── FAQ Management
    ├── Privacy Policy Management
    └── Terms & Conditions Management
```

---

# 8. Key Business Decisions Before UX/UI

Before final UX/UI design, MediSyn should confirm:

1. **Patient access:** Patients can register directly without manual approval — confirm final registration requirements.
2. **Clinic access:** Confirm required clinic information and MediSyn approval criteria.
3. **Pharmacy access:** Confirm required pharmacy information and approval criteria.
4. **Prescription workflow:** If a doctor sends a prescription directly to MediSyn, does the patient need an account?
5. **Vaccine appointments:** Should MVP1 use a simple request form, with slot-based booking introduced in MVP2?
6. **Shopping:** Is online shopping part of MVP1 or a later phase?
7. **Online payment:** Is payment required at launch if yes then what payment gateway?
8. **Privacy/compliance:** Which legal, pharmacy, privacy, data-storage, vendor, and security requirements must be validated before launch?


---

# 9. Detailed Requirements & Clarifications

The following questions will help us finalize the functional requirements, user experience, and development scope before UX/UI design begins.

## 9.1 User Accounts & Approval

### Patients

- What information should be required during patient registration?
- Should patients be able to submit general inquiries or appointment requests without creating an account?
- Can one patient account manage multiple family members or dependents?

### Clinics

- What information should a clinic provide during registration?
- Who at MediSyn will be responsible for approving clinic accounts?
- Can a clinic have multiple staff/user accounts?
- Should each clinic have a primary administrator who can manage its users?

### Pharmacy Partners

- What information should a pharmacy provide during registration?
- Are any verification documents required?
- Can one pharmacy have multiple staff/user accounts?

---

## 9.2 Prescription Workflow

For each prescription workflow — New Prescription, Transfer, Refill, Upload, and Custom Formulation:

- What information should the patient be required to provide?
- What information should the pharmacy/admin team be able to review?
- Should patients receive email notifications after submitting a request?
- What prescription request statuses should patients see?
- Who is responsible for updating the prescription status?
- Should patients be able to upload multiple prescription files?
- Which file types and maximum file sizes should be supported?

### Doctor-to-Pharmacy Prescription

- If a doctor sends a prescription directly to MediSyn, does the patient need to create a website account?
- If an account is not required, how should the prescription be associated with the patient?
- Should the patient receive an invitation to create an account later to view request/order information?

---

## 9.3 Vaccine Appointments

### MVP1 — Appointment Request

- Which vaccines/services should be available?
- What information should the appointment request form collect?
- Who will review and confirm appointment requests?
- Should patients receive email confirmation?

### MVP2 — Slot-Based Booking

- How long should each appointment slot be?
- How many patients can be booked per slot?
- Can different vaccines/services have different appointment durations?
- Will different vaccines/services have different schedules?
- Should patients be able to cancel or reschedule appointments?
- How far in advance should patients be able to book?

---

## 9.4 Shopping, Orders & Coupons

If online shopping is confirmed:

- Which products should be available for online purchase?
- Are some products restricted or subject to pharmacist approval?
- What should happen when a product is out of stock?
- Is there a minimum order value?
- What shipping rules should apply to each province?
- Which payment gateway should be used?
- What is the cancellation and refund process?

### MVP2 - Coupon Rules

- Should coupons support a minimum order value, such as **$400**?
- Should coupons support a maximum discount amount?
- Should usage limits be available?
- Should usage limits be applied per customer?
- Can coupons apply only to selected products or categories?
- Can more than one coupon be used on the same order?

---

## 9.5 Admin Roles & Permissions (I am talking about Medisyn)

- How many types of Admin users are required?
- Should there be different roles, such as **Super Admin, Pharmacist, and Staff**?
- Which users should be able to view patient information?
- Which users should be able to view prescription files?
- Which users should be able to approve Clinic and Pharmacy Partner accounts?
- MVP2 - Which users should be able to modify website content and policies?
- MVP2 - Should sensitive administrative actions be recorded in an activity/audit log?

---

## 9.6 Website Content & Dynamic Management

For MVP2 dynamic Admin management:

- Which website content should MediSyn staff be able to edit?
- Should Admin be able to edit complete pages or only selected sections?
- Which sections should be dynamic from the Admin Portal?
- Who will provide and approve the Privacy Policy and Terms & Conditions content?

---

## 9.7 Existing Systems & Integrations

- What pharmacy management or operational systems does MediSyn currently use?

---

## 9.8 Privacy, Data & Compliance Clarifications

- What patient information must be collected for each workflow?
- How long should prescription files and patient requests be retained?
- Are there specific requirements regarding where patient data must be stored or processed?
- Are there existing privacy or security policies that the new platform must follow?
- Who will provide final approval for privacy and compliance-related website content?

---

## 9.9 Requirements Priority

To help finalize the MVP roadmap, each feature can be categorized as:

### Must Have — MVP1

Required for the initial website launch.

### Should Have — MVP2

Important enhancements that can reduce manual work and improve self-service after launch.

### Future — MVP3

Advanced integrations, automation, analytics, and other enhancements that can be introduced later.

> **Final scope note:** These questions are intended to clarify requirements before UX/UI design and development. Not every item needs to be finalized at the same time. Features that are not required for MVP1 can be planned as MVP2 or MVP3 enhancements based on MediSyn's priorities, operational readiness, and budget.