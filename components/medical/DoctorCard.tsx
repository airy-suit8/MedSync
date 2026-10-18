import type React from "react"
import type { DirectoryDoctor } from "@/lib/doctor-search"

// How a doctor appears to patients: what they treat and what to share before a
// consultation. Doctors see the same card as a preview on their profile page.
export default function DoctorCard({ doctor, children }: { doctor: DirectoryDoctor; children?: React.ReactNode }) {
  return (
    <article className="flex h-full flex-col bg-white p-6 lg:p-8">
      <h3 className="text-xl font-bold">{doctor.name || "Doctor"}</h3>
      <p className="mt-1 font-mono text-xs uppercase tracking-widest text-black/60">{doctor.specialty || "General practice"}</p>
      {(doctor.qualification || doctor.license_number) && (
        <p className="mt-2 text-xs text-black/60">
          {doctor.qualification}
          {doctor.qualification && doctor.license_number && " · "}
          {doctor.license_number && <>Reg. no. {doctor.license_number}{doctor.medical_council ? ` (${doctor.medical_council})` : ""}</>}
        </p>
      )}

      <dl className="mt-6 flex-1 space-y-4 text-sm">
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-widest text-black/55">Treats</dt>
          <dd className="mt-1 leading-relaxed">{doctor.expertise || "This doctor hasn't described their expertise yet."}</dd>
        </div>
        {doctor.share_before && (
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-widest text-black/55">Please share before your visit</dt>
            <dd className="mt-1 leading-relaxed">{doctor.share_before}</dd>
          </div>
        )}
      </dl>

      {children && <div className="mt-6">{children}</div>}
    </article>
  )
}
