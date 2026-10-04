"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar, CalendarDays, Clock, User, Plus, ArrowRight, ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format, addDays, startOfWeek, eachDayOfInterval, isSameDay } from "date-fns"
import ScheduleAppointmentModal from "@/components/schedule-appointment-modal"

interface Appointment {
  id: string
  patient_name: string
  appointment_date: string
  start_time: string
  end_time: string
  appointment_type: string
  status: string
  notes?: string
}

export default function DoctorSchedulePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [weekDays, setWeekDays] = useState<Date[]>([])
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [doctorId, setDoctorId] = useState<string>("")
  const router = useRouter()

  useEffect(() => {
    // Generate week days
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start, end: addDays(start, 6) })
    setWeekDays(days)
  }, [selectedDate])

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user || user.app_metadata?.role !== "doctor") {
        router.push("/login")
        return
      }

      setUser(user)

      // Get the doctor ID from the doctors table
      const { data: doctorData } = await supabase
        .from('profile_directory')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (doctorData) {
        setDoctorId(doctorData.id)
      } else {
        // Fallback to user id if no doctor record
        setDoctorId(user.id)
      }

      await loadAppointments()
      setLoading(false)
    }

    checkUser()
  }, [router])

  const loadAppointments = async () => {
    const supabase = createClient()
    try {
      const { data } = await supabase
        .from('appointments')
        .select('*')
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true })

      setAppointments(data || [])
    } catch (error) {
      console.error('Error loading appointments:', error)
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  }

  const getAppointmentsForDay = (date: Date) => {
    return appointments.filter(apt =>
      isSameDay(new Date(apt.appointment_date), date)
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-black text-white'
      case 'scheduled': return 'bg-black/5 text-black border border-black/20'
      case 'completed': return 'bg-white text-black/60 border border-black/20'
      case 'cancelled': return 'bg-red-500 text-white'
      default: return 'bg-black text-white'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center flex flex-col items-center">
          <Calendar className="h-8 w-8 text-black animate-spin mx-auto mb-4" />
          <p className="text-black/60 font-mono uppercase text-xs tracking-widest">Loading schedule...</p>
        </div>
      </div>
    )
  }

  const todayAppointments = getAppointmentsForDay(new Date())
  const upcomingAppointments = appointments.filter(apt =>
    new Date(apt.appointment_date) > new Date()
  ).slice(0, 5)

  return (
    <div className="min-h-screen bg-transparent p-6 md:p-12 max-w-[1600px] mx-auto">
      {/* Header */}
      <header className="border-b border-black/10 pb-6 mb-8 flex-shrink-0 flex items-end justify-between">
        <div>
          <Link href="/doctor-dashboard" className="inline-flex items-center space-x-2 text-xs font-mono uppercase tracking-widest text-black/55 hover:text-black mb-4 transition-colors">
            <ArrowLeft className="h-3 w-3" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-bold tracking-tight uppercase">Your Schedule</h1>
          </div>
          <p className="text-sm font-mono text-black/60 uppercase mt-2">
            Appointments & Week View
          </p>
        </div>
        <div className="text-right hidden md:flex items-center gap-6">
          <Button className="bg-black hover:bg-black/80 text-white rounded-none font-mono uppercase text-xs h-12 px-6" onClick={() => setIsScheduleModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
          <div className="text-right">
            <span className="text-[10px] font-mono uppercase tracking-widest text-black/55 block mb-1">
              System Status
            </span>
            <span className="text-xl font-mono border-b border-black inline-flex items-center gap-2">
              <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
              ACTIVE
            </span>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="grid lg:grid-cols-12 gap-12">
        {/* Left Column - Today's Schedule */}
        <div className="lg:col-span-4 space-y-12">
          {/* Today */}
          <div>
            <div className="flex items-center gap-3 border-b border-black/10 pb-4 mb-6">
              <div className="h-2 w-2 bg-black rounded-full"></div>
              <h2 className="text-xl font-bold uppercase">{format(new Date(), 'EEEE, MMM d')}</h2>
              <span className="text-[10px] font-mono border border-black px-1.5 py-0.5 ml-auto uppercase">{todayAppointments.length} APPTS</span>
            </div>
            
            {todayAppointments.length > 0 ? (
              <div className="space-y-4">
                {todayAppointments.map(apt => (
                  <div key={apt.id} className="group border border-black/10 p-4 bg-white hover:border-black cursor-pointer transition-colors relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-black"></div>
                    <div className="pl-2">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-black" />
                          <span className="text-sm font-mono font-bold">{apt.start_time}</span>
                        </div>
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 ${getStatusColor(apt.status)}`}>
                          {apt.status}
                        </span>
                      </div>
                      <p className="font-bold text-lg uppercase mb-1">{apt.patient_name}</p>
                      <p className="text-[10px] font-mono text-black/60 uppercase">{apt.appointment_type}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border border-black/10 bg-black/[0.02]">
                <CalendarDays className="h-8 w-8 mx-auto mb-4 text-black/20" />
                <p className="font-mono text-xs uppercase tracking-widest text-black/55">NO APPOINTMENTS TODAY</p>
              </div>
            )}
          </div>

          {/* Upcoming */}
          <div>
            <div className="flex items-center gap-3 border-b border-black/10 pb-4 mb-6">
              <ArrowRight className="h-5 w-5 text-black" />
              <h2 className="text-xl font-bold uppercase">Upcoming</h2>
            </div>
            
            <div className="space-y-4">
              {upcomingAppointments.length > 0 ? (
                upcomingAppointments.map(apt => (
                  <div key={apt.id} className="flex items-center justify-between p-4 border border-black/10 bg-white hover:border-black transition-colors cursor-pointer group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold uppercase truncate group-hover:underline underline-offset-4">{apt.patient_name}</p>
                      <p className="text-[10px] font-mono text-black/60 uppercase mt-1">
                        {format(new Date(apt.appointment_date), 'dd MMM')} • {apt.start_time}
                      </p>
                    </div>
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 ${getStatusColor(apt.status)}`}>
                      {apt.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 border border-black/10 bg-black/[0.02]">
                  <p className="font-mono text-xs uppercase tracking-widest text-black/55">NO UPCOMING APPOINTMENTS</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Week View */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between border-b border-black/10 pb-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold uppercase mb-1">Week Overview</h2>
              <p className="text-xs font-mono text-black/60 uppercase">
                {format(weekDays[0], 'dd MMM')} — {format(weekDays[6], 'dd MMM yyyy')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-black rounded-none font-mono uppercase text-xs h-10 w-10 p-0"
                onClick={() => setSelectedDate(addDays(selectedDate, -7))}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="border-black rounded-none font-mono uppercase text-xs h-10 w-10 p-0"
                onClick={() => setSelectedDate(addDays(selectedDate, 7))}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px bg-black/10 border border-black/10">
            {weekDays.map((day, index) => {
              const dayAppointments = getAppointmentsForDay(day)
              const isToday = isSameDay(day, new Date())

              return (
                <div key={index} className="bg-white">
                  <div className={`text-center py-4 border-b ${isToday ? 'border-black bg-black text-white' : 'border-black/10 bg-black/[0.02]'}`}>
                    <p className={`text-[10px] font-mono uppercase tracking-wider mb-1 ${isToday ? 'text-white/60' : 'text-black/55'}`}>
                      {format(day, 'EEE')}
                    </p>
                    <p className={`text-xl font-bold`}>
                      {format(day, 'd')}
                    </p>
                  </div>
                  <div className="p-2 space-y-2 min-h-[300px] h-[calc(100vh-400px)] overflow-y-auto scrollbar-thin">
                    {dayAppointments.map(apt => (
                      <div
                        key={apt.id}
                        className={`p-2 border group cursor-pointer ${
                          apt.status === 'confirmed' ? 'border-black bg-black text-white' :
                          apt.status === 'scheduled' ? 'border-black/20 bg-white hover:border-black text-black' :
                          apt.status === 'completed' ? 'border-black/10 bg-black/5 text-black/55' :
                          'border-red-500 bg-red-50 text-red-700'
                        }`}
                      >
                        <p className={`text-[10px] font-mono mb-1 ${apt.status === 'confirmed' ? 'text-white/60' : 'text-black/60'}`}>
                          {apt.start_time}
                        </p>
                        <p className="text-xs font-bold uppercase truncate">{apt.patient_name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Schedule Appointment Modal */}
      <ScheduleAppointmentModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSuccess={() => loadAppointments()}
        doctorId={doctorId}
        doctorName={user?.user_metadata?.name}
      />
    </div>
  )
}
