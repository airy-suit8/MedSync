export type DirectoryDoctor = {
  id: string
  name: string | null
  specialty: string | null
  expertise: string | null
  share_before: string | null
}

// A patient's search matches the doctor's name, specialty or what they treat; every word
// has to match somewhere ("knee pain" finds a doctor who lists "knee" and "pain").
export function matchesDoctor(doctor: DirectoryDoctor, query: string) {
  const haystack = [doctor.name, doctor.specialty, doctor.expertise].join(" ").toLowerCase()
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => haystack.includes(word))
}
