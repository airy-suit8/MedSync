"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  FileText,
  MessageSquare,
  Calendar,
  Brain,
  Activity,
  LogOut,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Users,
  Stethoscope,
  UserCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface SidebarProps {
  userRole: 'doctor' | 'patient' | 'lab'
  userName?: string
  onLogout?: () => void
}

const menuItems = {
  doctor: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/doctor-dashboard' },
    { id: 'patients', label: 'My Patients', icon: Users, href: '/doctor-dashboard/patients' },
    { id: 'reports', label: 'Reports', icon: FileText, href: '/doctor-dashboard/reports' },
    { id: 'communication', label: 'Messages', icon: MessageSquare, href: '/doctor-dashboard/communication' },
    { id: 'schedule', label: 'Schedule', icon: Calendar, href: '/doctor-dashboard/schedule' },
    { id: 'ai-assistant', label: 'AI Assistant', icon: Brain, href: '/doctor-dashboard/ai-assistant' },
    { id: 'profile', label: 'Public Profile', icon: UserCircle, href: '/doctor-dashboard/profile' },
  ],
  patient: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/patient-dashboard' },
    { id: 'doctors', label: 'My Doctors', icon: Stethoscope, href: '/patient-dashboard/doctors' },
    { id: 'health', label: 'Health Record', icon: Activity, href: '/patient-dashboard/health' },
    { id: 'reports', label: 'My Reports', icon: FileText, href: '/patient-dashboard/reports' },
    { id: 'chat', label: 'Messages', icon: MessageSquare, href: '/patient-dashboard/chat' },
    { id: 'ai-assistant', label: 'AI Assistant', icon: Brain, href: '/patient-dashboard/ai-assistant' },
  ],
  lab: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/lab-dashboard' },
    { id: 'upload', label: 'Upload Reports', icon: FileText, href: '/lab-dashboard/upload' },
    { id: 'imaging', label: 'Imaging', icon: Activity, href: '/lab-dashboard/imaging' },
    { id: 'samples', label: 'Samples', icon: Calendar, href: '/lab-dashboard/samples' },
    { id: 'communication', label: 'Messages', icon: MessageSquare, href: '/lab-dashboard/communication' },
  ]
}

export default function Sidebar({ userRole, userName, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const items = menuItems[userRole]

  const roleLabels = {
    doctor: 'DOCTOR',
    patient: 'PATIENT',
    lab: 'LABORATORY'
  }

  return (
    <div className={`${collapsed ? 'w-20' : 'w-72'} bg-black text-white h-screen sticky top-0 flex flex-col transition-all duration-300 border-r border-white/10 relative z-50`}>
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          {!collapsed && (
            <div className="flex items-center space-x-3">
              <span className="text-xl font-bold tracking-tight">MedSync</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="text-white/60 hover:text-white hover:bg-white/10 h-8 w-8"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
        {!collapsed && (
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/50 block mb-1">
              PORTAL ACCESS
            </span>
            <span className="text-xs font-mono text-white/80 border px-1 py-0.5 border-white/20 inline-block">
              {roleLabels[userRole]}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-8 overflow-y-auto scrollbar-hide">
        <div className="space-y-2">
          {items.map((item, index) => {
            const isActive = pathname === item.href
            const Icon = item.icon

            return (
              <Link key={item.id} href={item.href}>
                <div className={`
                  flex items-center space-x-4 px-4 py-3 group transition-all duration-200 border border-transparent
                  ${isActive
                    ? 'bg-white text-black border-white'
                    : 'text-white/60 hover:text-white hover:border-white/20 hover:bg-white/5'
                  }
                `}>
                  <div className="relative">
                    {!collapsed && (
                      <span className={`absolute -left-2 top-0 text-[0.5rem] font-mono ${isActive ? 'text-black/55' : 'text-white/20 opacity-0 group-hover:opacity-100'}`}>
                        0{index + 1}
                      </span>
                    )}
                    <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'stroke-[2]' : 'stroke-[1.5]'}`} />
                  </div>
                  {!collapsed && (
                    <span className={`text-xs font-mono uppercase tracking-wider ${isActive ? 'font-bold' : 'font-medium'}`}>
                      {item.label}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User Info & Logout */}
      <div className="p-6 border-t border-white/10 bg-white/5 flex-shrink-0">
        {!collapsed && userName && (
          <div className="mb-6">
            <p className="text-[10px] font-mono uppercase tracking-widest text-white/50 mb-2">Logged in as</p>
            <div className="text-sm font-bold text-white truncate border-l-2 border-white pl-3">
              {userName}
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          onClick={onLogout}
          className={`w-full ${collapsed ? 'justify-center px-0' : 'justify-start space-x-3'} text-white/60 hover:text-white hover:bg-white/10 rounded-none border border-transparent hover:border-white/20`}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="text-xs font-mono uppercase tracking-widest">Sign Out</span>}
        </Button>
      </div>
    </div>
  )
}
