import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | MediSyn Compounding Pharmacy",
  description: "Terms and conditions for using the MediSyn pharmacy platform.",
};

const EFFECTIVE_DATE = "October 4, 2026";
const CONTACT_EMAIL  = "support@medisyn.ca";

export default function TermsPage() {
  return (
    <div className="bg-white px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Legal</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink-900">Terms of Service</h1>
        <p className="mt-2 text-sm text-slate-500">Effective: {EFFECTIVE_DATE}</p>

        <div className="mt-8 space-y-10 text-slate-700 leading-relaxed">
          <Section title="1. Acceptance of Terms">
            <p>
              By creating an account or using the MediSyn platform ("<strong>Platform</strong>"), you agree
              to these Terms of Service and our{" "}
              <Link href="/privacy-policy" className="text-brand-700 hover:underline">Privacy Policy</Link>.
              If you do not agree, do not use the Platform.
            </p>
          </Section>

          <Section title="2. Who We Are">
            <p>
              MediSyn Compounding Pharmacy is a licensed Ontario pharmacy. The Platform allows patients to
              submit prescription requests, book pharmacy appointments, consult with pharmacists, and purchase
              pharmacy products online.
            </p>
          </Section>

          <Section title="3. Not a Substitute for Professional Medical Advice">
            <p>
              The Platform is not a substitute for professional medical or pharmaceutical advice, diagnosis,
              or treatment. Information provided through Ask-a-Pharmacist consultations is for general guidance
              only. Always consult a qualified healthcare provider before making decisions about your health.
            </p>
            <p className="mt-3">
              In an emergency, call <strong>911</strong> or go to your nearest emergency room.
            </p>
          </Section>

          <Section title="4. Eligibility">
            <ul className="list-disc pl-5 space-y-1">
              <li>You must be at least 18 years of age, or have parental/guardian consent, to create an account.</li>
              <li>You must be a resident of Canada to use our pharmacy services.</li>
              <li>You must provide accurate and truthful information during registration and when submitting health requests.</li>
            </ul>
          </Section>

          <Section title="5. Your Account">
            <ul className="list-disc pl-5 space-y-1">
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You must notify us immediately at <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-700 hover:underline">{CONTACT_EMAIL}</a> if you suspect unauthorized access to your account.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>We reserve the right to suspend or terminate accounts for violations of these Terms.</li>
            </ul>
          </Section>

          <Section title="6. Prescription Services">
            <ul className="list-disc pl-5 space-y-1">
              <li>Prescriptions can only be filled based on valid prescriptions from licensed Canadian healthcare providers.</li>
              <li>You must provide accurate health and prescription information. Providing false information may result in account suspension and potential legal consequences.</li>
              <li>We reserve the right to verify prescriptions with your prescribing provider before dispensing.</li>
              <li>Prescription medications will only be dispensed to the named patient.</li>
            </ul>
          </Section>

          <Section title="7. Ecommerce and Orders">
            <ul className="list-disc pl-5 space-y-1">
              <li>All prices are in Canadian dollars (CAD) and include applicable taxes.</li>
              <li>Orders are subject to product availability. We reserve the right to cancel orders for out-of-stock items with full refunds.</li>
              <li>Certain products may only be sold to individuals who meet eligibility requirements (e.g., age, prescription status).</li>
              <li>Returns and refunds are subject to our Refund Policy.</li>
            </ul>
          </Section>

          <Section title="8. Prohibited Uses">
            <p>You must not:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Submit false, misleading, or fraudulent prescription information</li>
              <li>Attempt to obtain controlled substances without a valid prescription</li>
              <li>Use the Platform for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any part of the Platform</li>
              <li>Reverse-engineer or scrape the Platform</li>
              <li>Harass or abuse Platform staff</li>
            </ul>
          </Section>

          <Section title="9. Intellectual Property">
            <p>
              All content on the Platform — including text, logos, images, and software — is owned by or
              licensed to MediSyn and may not be reproduced without written permission.
            </p>
          </Section>

          <Section title="10. Privacy">
            <p>
              Your use of the Platform is governed by our{" "}
              <Link href="/privacy-policy" className="text-brand-700 hover:underline">Privacy Policy</Link>,
              which is incorporated into these Terms by reference. By using the Platform, you consent to the
              collection and use of your information as described therein.
            </p>
          </Section>

          <Section title="11. Limitation of Liability">
            <p>
              To the maximum extent permitted by applicable law, MediSyn shall not be liable for any indirect,
              incidental, special, or consequential damages arising from your use of the Platform. Our total
              liability to you for any claim shall not exceed the amount you paid to us in the 12 months preceding
              the claim.
            </p>
          </Section>

          <Section title="12. Indemnification">
            <p>
              You agree to indemnify and hold harmless MediSyn and its staff from any claims, damages, or
              expenses arising from your violation of these Terms or misuse of the Platform.
            </p>
          </Section>

          <Section title="13. Governing Law">
            <p>
              These Terms are governed by the laws of the Province of Ontario and the federal laws of Canada
              applicable therein. Any disputes shall be resolved in the courts of Ontario.
            </p>
          </Section>

          <Section title="14. Changes to These Terms">
            <p>
              We may update these Terms from time to time. We will notify you of material changes by email and
              will update the effective date above. Continued use of the Platform after changes take effect
              constitutes acceptance.
            </p>
          </Section>

          <Section title="15. Contact Us">
            <p>
              Questions about these Terms? Contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-700 hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </Section>
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
