import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | MediSyn Compounding Pharmacy",
  description: "How MediSyn collects, uses, and protects your personal and health information under PHIPA and PIPEDA.",
};

const EFFECTIVE_DATE = "October 4, 2026";
const POLICY_VERSION = "1.0";
const PRIVACY_EMAIL  = "privacy@medisyn.ca";

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-white px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Legal</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">
          Effective: {EFFECTIVE_DATE} · Version {POLICY_VERSION}
        </p>

        <div className="mt-8 space-y-10 text-slate-700 leading-relaxed">
          <Section title="1. Who We Are">
            <p>
              MediSyn Compounding Pharmacy ("<strong>MediSyn</strong>", "we", "our", or "us") is a licensed
              pharmacy operating in Ontario, Canada. We operate the MediSyn platform at{" "}
              <strong>medisyn.ca</strong>, which allows patients to manage prescriptions, book
              appointments, and communicate with pharmacists online.
            </p>
            <p className="mt-3">
              <strong>Privacy Officer:</strong> Our designated Privacy Officer can be reached at{" "}
              <a href={`mailto:${PRIVACY_EMAIL}`} className="text-brand-700 hover:underline">{PRIVACY_EMAIL}</a>.
              You may also write to us at our registered pharmacy address.
            </p>
          </Section>

          <Section title="2. Legislation That Governs Us">
            <p>As an Ontario pharmacy, we are subject to:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li><strong>PHIPA</strong> — Personal Health Information Protection Act (Ontario) — governs your Personal Health Information (PHI)</li>
              <li><strong>PIPEDA</strong> — Personal Information Protection and Electronic Documents Act (Federal) — governs personal information in commercial activities</li>
              <li><strong>CASL</strong> — Canada's Anti-Spam Legislation — governs commercial electronic messages</li>
              <li>Ontario College of Pharmacists standards and regulations</li>
            </ul>
          </Section>

          <Section title="3. What Information We Collect">
            <Subsection title="Personal Information (PIPEDA)">
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li>Name, email address, phone number</li>
                <li>Mailing and billing addresses</li>
                <li>Account credentials (passwords are hashed and never stored in readable form)</li>
                <li>Order and payment history (we do not store credit card numbers)</li>
                <li>Communication preferences</li>
              </ul>
            </Subsection>
            <Subsection title="Personal Health Information (PHIPA)">
              <p>When you use our healthcare services, we collect PHI including:</p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li>Prescription details (medication name, dosage, prescriber information)</li>
                <li>Health conditions and symptoms (minor ailments, compounding requests)</li>
                <li>Questions and answers exchanged with our pharmacists</li>
                <li>Appointment records and vaccine history</li>
                <li>Date of birth (where required for prescription verification)</li>
              </ul>
            </Subsection>
            <Subsection title="Technical Information">
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li>IP address and browser type (for security and fraud prevention)</li>
                <li>Log data including pages visited and actions taken</li>
                <li>Cookies (see our Cookie notice below)</li>
              </ul>
            </Subsection>
          </Section>

          <Section title="4. Why We Collect This Information">
            <p>We collect your information only for the purposes described at the time of collection. These include:</p>
            <ul className="mt-3 list-disc pl-5 space-y-1">
              <li>Filling and managing your prescriptions</li>
              <li>Booking and managing pharmacy appointments and vaccinations</li>
              <li>Responding to your Ask-a-Pharmacist consultations</li>
              <li>Processing your ecommerce orders and returns</li>
              <li>Creating and managing your patient account</li>
              <li>Sending you transactional communications (order confirmations, appointment reminders, prescription status updates)</li>
              <li>Complying with our legal and regulatory obligations as a licensed pharmacy</li>
              <li>Improving the safety and quality of our services</li>
            </ul>
            <p className="mt-3">
              We will <strong>never</strong> use your personal health information for marketing, research, or any
              purpose other than providing pharmacy services, unless you give us separate explicit consent.
            </p>
          </Section>

          <Section title="5. Your Consent">
            <p>
              By registering an account and using our services, you consent to the collection and use of your
              information as described in this policy. For Personal Health Information, your consent is collected
              explicitly during registration and is recorded with a timestamp, your IP address, and the version of
              this policy you agreed to.
            </p>
            <p className="mt-3">
              You may withdraw consent at any time by contacting our Privacy Officer. Note that withdrawing consent
              for PHI collection may prevent us from providing pharmacy services to you.
            </p>
          </Section>

          <Section title="6. How We Share Your Information">
            <p>We do not sell your personal information. We may share it only in the following circumstances:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li><strong>Healthcare providers:</strong> With your prescribing physician or clinic where required to fulfill a prescription</li>
              <li><strong>Regulatory bodies:</strong> With the Ontario College of Pharmacists or other regulators as required by law</li>
              <li><strong>Service providers:</strong> With third-party vendors who process data on our behalf (see Section 8) under data processing agreements</li>
              <li><strong>Legal requirements:</strong> Where required by court order or applicable law</li>
            </ul>
          </Section>

          <Section title="7. How We Protect Your Information">
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>All data is transmitted over encrypted HTTPS/TLS connections</li>
              <li>Data at rest is encrypted in our cloud database and file storage</li>
              <li>Passwords are hashed using Argon2 (a healthcare-grade algorithm)</li>
              <li>Access to PHI is restricted to authorized staff and logged for every access</li>
              <li>We use role-based access control — staff can only access records relevant to their role</li>
              <li>Authentication tokens expire after 15 minutes; sessions require regular re-authentication</li>
              <li>We log all login attempts and lock accounts after repeated failed attempts</li>
            </ul>
          </Section>

          <Section title="8. Third-Party Service Providers">
            <p>
              We use the following third-party services to operate our platform. Each provider has signed a data
              processing agreement and is required to protect your data in accordance with PHIPA and PIPEDA:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li><strong>Cloud database:</strong> MongoDB Atlas (encrypted at rest, Canadian or US region)</li>
              <li><strong>File storage:</strong> S3-compatible storage for prescription documents (private, access-controlled, encrypted)</li>
              <li><strong>Email delivery:</strong> Brevo / Resend (transactional emails only)</li>
            </ul>
            <p className="mt-3">
              We do not transfer your PHI outside Canada without your explicit consent, except where required by law.
            </p>
          </Section>

          <Section title="9. Data Retention">
            <p>
              We retain your Personal Health Information for a minimum of <strong>6 years</strong> following
              your last prescription or healthcare transaction, in accordance with Ontario pharmacy regulations.
              After this period, records are securely deleted or anonymized.
            </p>
            <p className="mt-3">
              Non-health personal information (account data, order history) is retained for as long as your
              account is active, or for up to 3 years after account closure.
            </p>
          </Section>

          <Section title="10. Your Rights">
            <p>Under PHIPA and PIPEDA, you have the right to:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li><strong>Access:</strong> Request a copy of all personal and health information we hold about you</li>
              <li><strong>Correction:</strong> Request corrections to inaccurate information</li>
              <li><strong>Withdraw consent:</strong> Withdraw consent for non-essential data uses at any time</li>
              <li><strong>Data portability:</strong> Request your data in a machine-readable format</li>
              <li><strong>Erasure:</strong> Request deletion of your data (subject to legal retention obligations)</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact our Privacy Officer at{" "}
              <a href={`mailto:${PRIVACY_EMAIL}`} className="text-brand-700 hover:underline">{PRIVACY_EMAIL}</a>.
              We will respond within <strong>30 days</strong>.
            </p>
          </Section>

          <Section title="11. Marketing Communications (CASL)">
            <p>
              We will only send you promotional or marketing emails if you have explicitly opted in during
              registration or at a later time. Every marketing email includes an unsubscribe link. You may also
              unsubscribe at any time by emailing{" "}
              <a href={`mailto:${PRIVACY_EMAIL}`} className="text-brand-700 hover:underline">{PRIVACY_EMAIL}</a>{" "}
              or visiting our{" "}
              <Link href="/unsubscribe" className="text-brand-700 hover:underline">unsubscribe page</Link>.
            </p>
            <p className="mt-3">
              Transactional emails (appointment reminders, prescription status updates, order confirmations) are
              operational communications and are not subject to marketing opt-out.
            </p>
          </Section>

          <Section title="12. Breach Notification">
            <p>
              In the event of a privacy breach involving your personal health information, we will notify you and
              the Ontario Privacy Commissioner as required by PHIPA §12. Notification will occur within 30 days
              of discovering the breach.
            </p>
          </Section>

          <Section title="13. Cookies">
            <p>
              We use essential cookies to keep you logged in and secure your session. We do not use advertising
              or tracking cookies. You may disable cookies in your browser settings, but this will prevent login.
            </p>
          </Section>

          <Section title="14. Complaints">
            <p>
              If you believe we have violated your privacy rights, you may contact our Privacy Officer at{" "}
              <a href={`mailto:${PRIVACY_EMAIL}`} className="text-brand-700 hover:underline">{PRIVACY_EMAIL}</a>.
            </p>
            <p className="mt-3">
              You may also file a complaint with:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li><strong>Privacy Commissioner of Canada (PIPEDA):</strong> <a href="https://www.priv.gc.ca" target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">www.priv.gc.ca</a></li>
              <li><strong>Information and Privacy Commissioner of Ontario (PHIPA):</strong> <a href="https://www.ipc.on.ca" target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">www.ipc.on.ca</a></li>
            </ul>
          </Section>

          <Section title="15. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. When we do, we will update the effective date
              and version number above, and notify you by email if the changes are material. Continued use of our
              services after changes take effect constitutes acceptance of the new policy.
            </p>
          </Section>

          <div className="mt-12 rounded-xl bg-brand-50 p-6 text-sm">
            <p className="font-semibold text-brand-900">Questions about your privacy?</p>
            <p className="mt-1 text-brand-700">
              Contact our Privacy Officer at{" "}
              <a href={`mailto:${PRIVACY_EMAIL}`} className="font-semibold hover:underline">{PRIVACY_EMAIL}</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-ink-900 border-b border-slate-200 pb-2 mb-4">{title}</h2>
      <div className="text-slate-700">{children}</div>
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-1">{title}</h3>
      {children}
    </div>
  );
}
