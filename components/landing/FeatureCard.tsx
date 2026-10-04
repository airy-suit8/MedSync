import { Activity, Zap, Shield, Users, FileText, Brain, LucideIcon } from "lucide-react"

const iconMap: Record<string, LucideIcon> = {
  Activity,
  Zap,
  Shield,
  Users,
  FileText,
  Brain
}

interface FeatureCardProps {
  index: string
  iconName: string
  title: string
  description: string
  tag: string
}

export default function FeatureCard({ index, iconName, title, description, tag }: FeatureCardProps) {
  const Icon = iconMap[iconName] || Activity

  return (
    <div className="reveal-on-scroll bg-white p-10 lg:p-12 group hover:bg-black/[0.02] transition-colors">
      <div className="mb-8">
        <span className="text-xs font-mono text-black/55">{index}</span>
      </div>
      <div className="mb-6">
        <Icon className="h-8 w-8 stroke-[1.5]" />
      </div>
      <h3 className="text-2xl font-bold mb-4">{title}</h3>
      <p className="text-black/60 leading-relaxed mb-6">
        {description}
      </p>
      <div className="flex items-center text-sm font-mono text-black/55">
        {tag} →
      </div>
    </div>
  )
}
