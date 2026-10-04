import type { Metadata } from "next"
import Link from "next/link"
import LegalPage from "@/components/legal/LegalPage"

export const metadata: Metadata = { title: "Terms of Service - MedSync" }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="4 October 2026">
      <section>
        <h2>What MedSync is</h2>
        <p>
          MedSync is an academic software prototype built by a student team at Parul University to connect patients,
          doctors and laboratory technicians. It is not a hospital, clinic or healthcare provider, and it is provided
          as is, without guarantees of availability or fitness for clinical use.
        </p>
      </section>

      <section>
        <h2>Not for emergencies</h2>
        <p>
          MedSync is not monitored for emergencies. If you or someone else needs urgent medical help, call
          <strong> 112</strong> or go to the nearest emergency department.
        </p>
      </section>

      <section>
        <h2>AI results</h2>
        <p>
          AI and image-analysis results are decision support for clinicians, not diagnoses. The models are an
          unvalidated research prototype and can be wrong. Doctors remain responsible for their own clinical decisions.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>You must be 18 or over.</li>
          <li>Register with your real identity and role. Do not pose as a doctor, lab or another person.</li>
          <li>Only upload or share medical information you are authorised to share.</li>
          <li>Keep your password private; you are responsible for activity on your account.</li>
        </ul>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>
          Do not try to access data you are not permitted to see, disrupt the service, or use it to harass anyone.
          The team may suspend accounts that break these terms.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Questions about these terms: <strong>[contact email to be added]</strong>.</p>
      </section>

      <p>See also the <Link href="/privacy">Privacy Policy</Link>.</p>
    </LegalPage>
  )
}
