import type { Metadata } from "next"
import Link from "next/link"
import LegalPage from "@/components/legal/LegalPage"

export const metadata: Metadata = { title: "Privacy Policy - MedSync" }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="4 October 2026">
      <section>
        <h2>Who we are</h2>
        <p>
          MedSync is an academic software prototype built by a student team at Parul University. It is not a
          hospital, clinic or healthcare provider. For questions, corrections, deletion requests or complaints about
          your data, contact the team at <strong>[contact email to be added]</strong>. We aim to respond within 90 days.
        </p>
      </section>

      <section>
        <h2>What we collect and why</h2>
        <ul>
          <li><strong>Account details</strong> (name, email, role, password managed by Supabase Auth): to give you an account and the right dashboard.</li>
          <li><strong>Medical reports and scan images</strong> uploaded by labs: so your doctor can review them and the AI models can analyse them.</li>
          <li><strong>AI analysis results</strong> (findings, confidence, severity): shown to your doctor as decision support and to you in your reports.</li>
          <li><strong>Appointments</strong> (date, time, notes, diagnosis, prescription): to schedule and record consultations.</li>
          <li><strong>Messages and notifications</strong>: to let patients, doctors and labs communicate.</li>
          <li><strong>Questions you type into the AI assistants</strong>: to generate an answer.</li>
          <li><strong>Access logs</strong> (who viewed or changed a record, and when): to keep medical records accountable.</li>
          <li><strong>Technical data</strong> (IP address, browser requests): to run, secure and rate-limit the service.</li>
        </ul>
        <p>Video consultations are peer-to-peer and are not recorded.</p>
      </section>

      <section>
        <h2>Who receives your data</h2>
        <ul>
          <li><strong>Supabase</strong>: stores accounts, records, files and messages (database, authentication, storage, realtime).</li>
          <li><strong>Vercel</strong>: hosts the website and keeps request logs.</li>
          <li><strong>Google Gemini</strong>: receives the text you type into the AI assistants. <strong>[Tier to be confirmed: on Google&apos;s unpaid tier, submitted content may be used to improve Google products.]</strong> Do not include names or other identifying details.</li>
          <li><strong>Hugging Face</strong>: hosts our image-analysis service, which receives scan images and the scan type, without your name.</li>
          <li><strong>Google STUN servers</strong>: see participants&apos; IP addresses so video calls can connect.</li>
          <li><strong>Upstash</strong>: may receive IP addresses for rate limiting, if enabled.</li>
        </ul>
        <p>We do not sell your data or use it for advertising.</p>
      </section>

      <section>
        <h2>AI is decision support, not diagnosis</h2>
        <p>
          MedSync&apos;s image models are an unvalidated research prototype and are not a certified medical device. Their
          results are shown to clinicians for review and must not be used on their own to make medical decisions.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          MedSync only uses cookies that are strictly necessary to keep you signed in (Supabase session cookies). There
          are no analytics, advertising or tracking cookies.
        </p>
      </section>

      <section>
        <h2>How long we keep data</h2>
        <p><strong>[Retention period to be decided by the team.]</strong> Access logs are kept for at least one year.</p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          You can ask to access, correct or delete your data, withdraw your consent, or complain about how it is
          handled, by contacting the team at the address above.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>MedSync is for people aged 18 or over. We do not knowingly process data of children.</p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Data is encrypted in transit (HTTPS) and at rest by Supabase. Database access is restricted by role so that
          patients, doctors and labs only see what they are permitted to.
        </p>
      </section>

      <p>See also the <Link href="/terms">Terms of Service</Link>.</p>
    </LegalPage>
  )
}
