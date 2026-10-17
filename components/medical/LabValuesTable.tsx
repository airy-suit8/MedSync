import type { LabValue } from "@/lib/lab-report-ai"

// Values the AI read from a blood or urine report, with values outside their printed
// reference range marked. Used on the doctor's and the patient's report pages.
export default function LabValuesTable({ tests }: { tests: LabValue[] }) {
  if (!tests.length) return null
  return (
    <div className="overflow-x-auto border border-black/10">
      <table className="w-full text-sm">
        <caption className="sr-only">Test values read from the report</caption>
        <thead className="bg-black/[0.03] text-left font-mono text-[11px] uppercase tracking-widest text-black/60">
          <tr>
            <th scope="col" className="px-4 py-3">Test</th>
            <th scope="col" className="px-4 py-3">Value</th>
            <th scope="col" className="px-4 py-3">Reference range</th>
            <th scope="col" className="px-4 py-3">Flag</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/10 tabular-nums">
          {tests.map((t, i) => {
            const out = t.flag === "low" || t.flag === "high"
            return (
              <tr key={`${t.name}-${i}`} className={out ? "bg-amber-50" : undefined}>
                <th scope="row" className="px-4 py-2.5 text-left font-medium">{t.name}</th>
                <td className="px-4 py-2.5">{t.value}{t.unit ? ` ${t.unit}` : ""}</td>
                <td className="px-4 py-2.5 text-black/70">{t.range || "—"}</td>
                <td className={`px-4 py-2.5 font-mono text-xs uppercase ${out ? "font-bold text-amber-900" : "text-black/60"}`}>
                  {t.flag === "unknown" ? "—" : t.flag}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
