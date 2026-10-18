import type { Metadata } from "next"
import Link from "next/link"
import LegalPage from "@/components/legal/LegalPage"
import { CONTACT_EMAIL } from "@/lib/constants"

export const metadata: Metadata = { title: "Privacy Policy - MedSync" }

const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="18 October 2026">
      <section>
        <h2>Who we are</h2>
        <p>
          MedSync is an academic software prototype built by a student team at Parul University. It is not a
          hospital, clinic or healthcare provider. For questions, corrections, a copy of your data, deletion requests or
          complaints, email {mail}. We reply within 90 days, as the Digital Personal Data Protection Rules, 2025 require.
        </p>
      </section>

      <section>
        <h2>What we collect and why</h2>
        <ul>
          <li><strong>Account details</strong> (name, email, role; your password is managed by Supabase Auth): to give you an account and the right dashboard.</li>
          <li><strong>Doctors&apos; and labs&apos; registration details</strong> (medical council, registration number, qualification): so an admin can check them, and so patients can see them, as the Telemedicine Practice Guidelines 2020 require.</li>
          <li><strong>Your health profile</strong> (date of birth, gender, blood group, height, weight, allergies, medicines, long-term conditions, emergency contact), if you fill it in: so your doctors can treat you safely.</li>
          <li><strong>Medical reports and scans</strong> uploaded by labs, and the <strong>AI&apos;s reading</strong> of them: so your doctor can review them.</li>
          <li><strong>Doctors&apos; reviews</strong> (a verdict, a note for you, an optional photo of a handwritten note, and a private note seen only by your other doctors), <strong>prescriptions</strong>, and <strong>appointments</strong> with consultation notes.</li>
          <li><strong>Messages and notifications</strong>: so patients, doctors and labs can communicate.</li>
          <li><strong>Questions you type into the AI assistants</strong>: to generate an answer.</li>
          <li><strong>Access logs</strong> (who viewed or changed a record, and when): to keep medical records accountable.</li>
          <li><strong>Technical data</strong> (IP address, browser requests): to run, secure and rate-limit the service.</li>
        </ul>
        <p>Video consultations are peer-to-peer and are not recorded.</p>
      </section>

      <section>
        <h2>Who can see your records</h2>
        <ul>
          <li><strong>You</strong> see your own records. The AI&apos;s reading of a report is shown to you only with your doctor&apos;s review.</li>
          <li><strong>Your doctors</strong> see your records while they are caring for you. You choose your doctors and can end care at any time; they then lose access.</li>
          <li><strong>Labs</strong> see the reports they upload for you.</li>
          <li><strong>MedSync admins</strong> see account details (name, email, role, registration details) to approve doctors and labs and to help with accounts. They cannot see reports, notes, prescriptions or messages.</li>
        </ul>
      </section>

      <section>
        <h2>Who else receives data</h2>
        <ul>
          <li><strong>Supabase</strong>: stores accounts, records, files and messages (database, authentication, storage, realtime).</li>
          <li><strong>Vercel</strong>: hosts the website and keeps request logs.</li>
          <li><strong>Google Gemini</strong>: receives the questions you type into the AI assistants, and blood and urine report files so the AI can read their values. On Google&apos;s unpaid tier, Google may use submitted content to improve its products. Because MedSync is a prototype, do not enter or upload real patients&apos; data.</li>
          <li><strong>Hugging Face</strong>: hosts our image-analysis service, which receives X-ray and MRI images and the scan type, without your name.</li>
          <li><strong>Your browser&apos;s speech service</strong>: if a doctor uses dictation, the browser sends the audio to its maker (for example Google in Chrome or Microsoft in Edge) to turn it into text.</li>
          <li><strong>Google STUN servers</strong>: see participants&apos; IP addresses so video calls can connect.</li>
          <li><strong>Upstash</strong>: may receive IP addresses for rate limiting, if enabled.</li>
        </ul>
        <p>We do not sell your data or use it for advertising.</p>
      </section>

      <section>
        <h2>AI is decision support, not diagnosis</h2>
        <p>
          MedSync&apos;s AI is an unvalidated research prototype and is not a certified medical device. Its readings are
          shown to doctors for review and must not be used on their own to make medical decisions.
        </p>
      </section>

      <section>
        <h2>How long we keep data</h2>
        <ul>
          <li>
            <strong>Medical records</strong> (reports, scans, doctors&apos; reviews and notes, prescriptions, consultation
            notes) are kept for <strong>3 years after your last report, consultation or prescription</strong>, then deleted.
            Doctors in India must keep patients&apos; records for 3 years under the Indian Medical Council (Professional
            Conduct, Etiquette and Ethics) Regulations, 2002, and the Telemedicine Practice Guidelines 2020 apply the same
            record-keeping to online consultations. The Digital Personal Data Protection Act, 2023 allows data to be kept
            for as long as a law requires.
          </li>
          <li>
            <strong>When you close your account</strong> (Account, in your dashboard): you can no longer sign in, your
            doctors lose access, and your phone number, address and emergency contact are deleted straight away. Your name,
            email and medical records are kept for the period above so the records stay identifiable, then the account and
            everything in it are deleted for good. If you have no medical records, the account is deleted within 90 days.
          </li>
          <li>
            <strong>Doctors&apos; and labs&apos; entries</strong> in a patient&apos;s records (reviews, prescriptions,
            uploaded reports) are part of that patient&apos;s records and are kept with them, including the doctor&apos;s
            name and registration number.
          </li>
          <li><strong>Access logs</strong> are kept for at least one year, as the Digital Personal Data Protection Rules, 2025 require.</li>
        </ul>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>Under the Digital Personal Data Protection Act, 2023 you can:</p>
        <ul>
          <li>get a summary of the personal data we hold about you and who we have shared it with;</li>
          <li>have it corrected, completed or updated;</li>
          <li>have it erased, except what a law requires us to keep (see above);</li>
          <li>withdraw your consent, by closing your account;</li>
          <li>nominate someone to exercise these rights if you die or are unable to;</li>
          <li>raise a complaint with us, and if you are not satisfied with our answer, with the Data Protection Board of India.</li>
        </ul>
        <p>Email {mail} for any of these. We reply within 90 days.</p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          MedSync only uses cookies that are strictly necessary to keep you signed in (Supabase session cookies). There
          are no analytics, advertising or tracking cookies.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>MedSync is for people aged 18 or over. We do not knowingly process data of children.</p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Data is encrypted in transit (HTTPS) and at rest by Supabase. Database access is restricted by role, so
          patients, doctors, labs and admins only see what they are permitted to, and every time a doctor opens a report
          it is logged.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>If we change this policy, we update the date at the top of this page.</p>
      </section>

      <p>See also the <Link href="/terms">Terms of Service</Link>.</p>
    </LegalPage>
  )
}
