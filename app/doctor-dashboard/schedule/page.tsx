"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Calendar, CalendarDays, Clock, User, ArrowLeft, Plus, Edit, Trash2, CheckCircle, XCircle, AlertCircle, Calendar as CalendarIcon, Save, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, addMinutes, parse } from "date-fns"

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

interface DoctorAvailability {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
}

export default function DoctorSchedulePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [availability, setAvailability] = useState<DoctorAvailability[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showNewAppointment, setShowNewAppointment] = useState(false)
  const [showAvailability, setShowAvailability] = useState(false)
  const [savingAvailability, setSavingAvailability] = useState(false)
  const [creatingAppointment, setCreatingAppointment] = useState(false)
  const [newAppointment, setNewAppointment] = useState({
    patient_name: "",
    appointment_date: format(new Date(), "yyyy-MM-dd"),
    start_time: "09:00",
    notes: ""
  })
  const [stats, setStats] = useState({
    total: 0,
    confirmed: 0,
    pending: 0,
    completed: 0,
    cancelled: 0
  })
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user || user.user_metadata?.role !== "doctor") {
        router.push("/login")
        return
      }
      
      setUser(user)
      await loadScheduleData()
      setLoading(false)
    }
    
    checkUser()
  }, [router])

  const loadScheduleData = async () => {
    const supabase = createClient()
    
    try {
      // Get the current authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        console.error('User error:', userError)
        setError('Authentication error. Please log in again.')
        return
      }

      console.log('Loading schedule data for user:', user.id)

      // Load appointments for the current month
      const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
      const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)
      
      console.log('Date range:', format(startOfMonth, 'yyyy-MM-dd'), 'to', format(endOfMonth, 'yyyy-MM-dd'))

      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', user.id)
        .gte('appointment_date', format(startOfMonth, 'yyyy-MM-dd'))
        .lte('appointment_date', format(endOfMonth, 'yyyy-MM-dd'))
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true })

      console.log('Appointments query result:', { data: appointmentsData, error: appointmentsError })

      if (appointmentsError) {
        console.error('Error loading appointments:', {
          message: appointmentsError?.message || 'No message',
          details: appointmentsError?.details || 'No details',
          hint: appointmentsError?.hint || 'No hint',
          code: appointmentsError?.code || 'No code'
        })
        
        // Handle empty error object case
        if (!appointmentsError?.message && !appointmentsError?.code) {
          console.log('Empty error object detected, trying fallback approach')
          setAppointments([])
          setStats({ total: 0, confirmed: 0, pending: 0, completed: 0, cancelled: 0 })
          setError('No appointments found. You can create new appointments.')
        } else {
          setError(`Failed to load appointments: ${appointmentsError?.message || 'Unknown error'}`)
        }
        return
      }

      // Check if appointmentsData is null or undefined
      if (!appointmentsData) {
        console.log('No appointments data returned, setting empty array')
        setAppointments([])
        setStats({ total: 0, confirmed: 0, pending: 0, completed: 0, cancelled: 0 })
      } else {
        console.log('Setting appointments:', appointmentsData.length, 'appointments')
        setAppointments(appointmentsData)
        
        // Calculate stats
        const total = appointmentsData.length
        const confirmed = appointmentsData.filter(a => a.status === 'confirmed').length
        const pending = appointmentsData.filter(a => a.status === 'scheduled').length
        const completed = appointmentsData.filter(a => a.status === 'completed').length
        const cancelled = appointmentsData.filter(a => a.status === 'cancelled').length
        
        setStats({ total, confirmed, pending, completed, cancelled })
      }

      // Load doctor availability
      const { data: availabilityData, error: availabilityError } = await supabase
        .from('doctor_availability')
        .select('*')
        .eq('doctor_id', user.id)
        .order('day_of_week')

      console.log('Availability query result:', { data: availabilityData, error: availabilityError })

      if (availabilityError) {
        console.error('Error loading availability:', {
          message: availabilityError?.message || 'No message',
          details: availabilityError?.details || 'No details',
          hint: availabilityError?.hint || 'No hint',
          code: availabilityError?.code || 'No code'
        })
        setError('Failed to load availability settings.')
        return
      }

      if (availabilityData && availabilityData.length > 0) {
        setAvailability(availabilityData)
      } else {
        // Initialize default availability if none exists
        console.log('No availability data found, initializing default')
        await initializeDefaultAvailability(user.id)
      }
    } catch (error) {
      console.error('Error loading schedule data:', error)
      setError('An unexpected error occurred while loading data.')
    }
  }

  const initializeDefaultAvailability = async (doctorId: string) => {
    const supabase = createClient()
    
    try {
      const defaultAvailability = [
        { doctor_id: doctorId, day_of_week: 1, start_time: '09:00:00', end_time: '17:00:00', is_available: true }, // Monday
        { doctor_id: doctorId, day_of_week: 2, start_time: '09:00:00', end_time: '17:00:00', is_available: true }, // Tuesday
        { doctor_id: doctorId, day_of_week: 3, start_time: '09:00:00', end_time: '17:00:00', is_available: true }, // Wednesday
        { doctor_id: doctorId, day_of_week: 4, start_time: '09:00:00', end_time: '17:00:00', is_available: true }, // Thursday
        { doctor_id: doctorId, day_of_week: 5, start_time: '09:00:00', end_time: '17:00:00', is_available: true }, // Friday
        { doctor_id: doctorId, day_of_week: 6, start_time: '10:00:00', end_time: '14:00:00', is_available: true }, // Saturday
        { doctor_id: doctorId, day_of_week: 0, start_time: '00:00:00', end_time: '00:00:00', is_available: false }, // Sunday
      ]

      const { error } = await supabase
        .from('doctor_availability')
        .insert(defaultAvailability)

      if (!error) {
        // Reload availability data
        const { data: newAvailabilityData } = await supabase
          .from('doctor_availability')
          .select('*')
          .eq('doctor_id', doctorId)
          .order('day_of_week')
        
        if (newAvailabilityData) {
          setAvailability(newAvailabilityData)
        }
      }
    } catch (error) {
      console.error('Error initializing availability:', error)
    }
  }

  const handleCreateAppointment = async () => {
    // Validate required fields
    if (!newAppointment.patient_name.trim()) {
      alert('Please enter a patient name')
      return
    }
    if (!newAppointment.appointment_date) {
      alert('Please select an appointment date')
      return
    }
    if (!newAppointment.start_time) {
      alert('Please select a start time')
      return
    }

    const supabase = createClient()

    try {
      const startTime = newAppointment.start_time
      const endTime = format(addMinutes(parse(newAppointment.start_time, 'HH:mm', new Date()), 30), 'HH:mm')

      // Get the current authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        alert('Authentication error. Please log in again.')
        return
      }

      // Create appointment with minimal required fields
      const appointmentData: any = {
        doctor_id: user.id,
        patient_id: user.id, // TODO: Replace with actual patient ID if available
        patient_name: newAppointment.patient_name.trim(),
        appointment_date: newAppointment.appointment_date,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: 30,
        appointment_type: 'Consultation',
        status: 'scheduled'
      }
      if (newAppointment.notes?.trim()) {
        appointmentData.notes = newAppointment.notes.trim()
      }

      const { error } = await supabase
        .from('appointments')
        .insert(appointmentData)

      if (error) {
        alert(`Failed to create appointment: ${error?.message || 'Unknown error'}`)
        return
      }

      setShowNewAppointment(false)
      setNewAppointment({
        patient_name: "",
        appointment_date: format(new Date(), "yyyy-MM-dd"),
        start_time: "09:00",
        notes: ""
      })
      await loadScheduleData()
      alert('Appointment created successfully!')
    } catch (error) {
      alert('An unexpected error occurred. Please try again.')
    }
  }

  const handleSaveAvailability = async () => {
    setSavingAvailability(true)
    const supabase = createClient()
    
    try {
      // Get the current authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        alert('Authentication error. Please log in again.')
        return
      }

      // Update each availability record
      for (const day of availability) {
        const { error } = await supabase
          .from('doctor_availability')
          .update({
            start_time: day.start_time,
            end_time: day.end_time,
            is_available: day.is_available
          })
          .eq('id', day.id)

        if (error) {
          console.error('Error updating availability:', {
            message: error?.message || 'No message',
            details: error?.details || 'No details',
            hint: error?.hint || 'No hint',
            code: error?.code || 'No code'
          })
          alert('Failed to save availability settings.')
          return
        }
      }

      setShowAvailability(false)
      alert('Availability settings saved successfully!')
      
    } catch (error) {
      console.error('Error saving availability:', error)
      alert('An unexpected error occurred while saving availability.')
    } finally {
      setSavingAvailability(false)
    }
  }

  const handleUpdateAppointmentStatus = async (appointmentId: string, status: string) => {
    const supabase = createClient()
    
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', appointmentId)

      if (!error) {
        await loadScheduleData()
      } else {
        console.error('Error updating appointment:', {
          message: error?.message || 'No message',
          details: error?.details || 'No details',
          hint: error?.hint || 'No hint',
          code: error?.code || 'No code'
        })
        alert('Failed to update appointment status.')
      }
    } catch (error) {
      console.error('Error updating appointment:', error)
      alert('An unexpected error occurred.')
    }
  }

  const getTodaysAppointments = () => {
    return appointments.filter(a => isSameDay(parseISO(a.appointment_date), new Date()))
  }

  const getWeekAppointments = () => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 })
    const end = endOfWeek(selectedDate, { weekStartsOn: 1 })
    const weekDays = eachDayOfInterval({ start, end })
    
    return weekDays.map(day => ({
      date: day,
      appointments: appointments.filter(a => isSameDay(parseISO(a.appointment_date), day))
    }))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800'
      case 'scheduled': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      case 'no-show': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircle className="h-4 w-4" />
      case 'scheduled': return <Clock className="h-4 w-4" />
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'cancelled': return <XCircle className="h-4 w-4" />
      case 'no-show': return <AlertCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const testDatabaseConnection = async () => {
    const supabase = createClient()
    
    try {
      console.log('Testing database connectivity...')
      
      // Test if we can access the appointments table
      const { data, error } = await supabase
        .from('appointments')
        .select('count')
        .limit(1)
      
      console.log('Database test result:', { data, error })
      
      if (error) {
        console.error('Database connection test failed:', {
          message: error?.message || 'No message',
          details: error?.details || 'No details',
          hint: error?.hint || 'No hint',
          code: error?.code || 'No code'
        })
        
        if (error?.code === '42P01') {
          console.error('Table does not exist. Please run the database setup script.')
          setError('Database table not found. Please contact support.')
        } else if (error?.code === '42501') {
          console.error('Permission denied. RLS policies may be too restrictive.')
          setError('Permission denied. Please check database policies.')
        } else {
          setError('Database connection issue. Please check your setup.')
        }
      } else {
        console.log('Database connection successful')
      }
    } catch (error) {
      console.error('Database test error:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading schedule...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/doctor-dashboard" className="flex items-center space-x-2 text-blue-600 hover:text-blue-700">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
          <div className="flex items-center space-x-2">
            <Image src="/medi.png" alt="MedSync Logo" width={32} height={32} />
            <span className="text-2xl font-bold text-gray-900">MedSync</span>
            <Badge className="bg-blue-100 text-blue-800">Doctor Portal</Badge>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-red-800">{error}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setError(null)}
              className="mt-2"
            >
              Dismiss
            </Button>
          </div>
        )}

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Schedule Management</h1>
            <p className="text-gray-600">Manage appointments and consultation schedules</p>
          </div>
          <div className="flex space-x-3">
            <Dialog open={showNewAppointment} onOpenChange={setShowNewAppointment}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  New Appointment
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Appointment</DialogTitle>
                  <DialogDescription>
                    Schedule a new appointment with a patient
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="patient-name">Patient Name</Label>
                    <Input
                      id="patient-name"
                      value={newAppointment.patient_name}
                      onChange={(e) => setNewAppointment({...newAppointment, patient_name: e.target.value})}
                      placeholder="Enter patient name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="appointment-date">Date</Label>
                    <Input
                      id="appointment-date"
                      type="date"
                      value={newAppointment.appointment_date}
                      onChange={(e) => setNewAppointment({...newAppointment, appointment_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="start-time">Start Time</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={newAppointment.start_time}
                      onChange={(e) => setNewAppointment({...newAppointment, start_time: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={newAppointment.notes}
                      onChange={(e) => setNewAppointment({...newAppointment, notes: e.target.value})}
                      placeholder="Add appointment notes"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" onClick={() => setShowNewAppointment(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreateAppointment} 
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      disabled={creatingAppointment}
                    >
                      {creatingAppointment ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Appointment'
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            <Dialog open={showAvailability} onOpenChange={setShowAvailability}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Set Availability
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Set Your Availability</DialogTitle>
                  <DialogDescription>
                    Configure your working hours for each day of the week
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {availability.map((day) => (
                    <div key={day.id} className="flex items-center space-x-3">
                      <div className="w-20 text-sm font-medium">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.day_of_week]}
                      </div>
                      <Input
                        type="time"
                        value={day.start_time}
                        onChange={(e) => {
                          const updated = availability.map(a => 
                            a.id === day.id ? {...a, start_time: e.target.value} : a
                          )
                          setAvailability(updated)
                        }}
                        className="w-24"
                      />
                      <span className="text-gray-500">to</span>
                      <Input
                        type="time"
                        value={day.end_time}
                        onChange={(e) => {
                          const updated = availability.map(a => 
                            a.id === day.id ? {...a, end_time: e.target.value} : a
                          )
                          setAvailability(updated)
                        }}
                        className="w-24"
                      />
                    </div>
                  ))}
                  <div className="flex space-x-2">
                    <Button variant="outline" onClick={() => setShowAvailability(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSaveAvailability} 
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      disabled={savingAvailability}
                    >
                      {savingAvailability ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Availability
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Schedule Statistics */}
        <div className="grid md:grid-cols-5 gap-6 mb-8">
          <Card className="border-blue-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <p className="text-xs text-gray-500">This month</p>
            </CardContent>
          </Card>

          <Card className="border-green-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Confirmed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
              <p className="text-xs text-gray-500">This month</p>
            </CardContent>
          </Card>

          <Card className="border-yellow-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-xs text-gray-500">This month</p>
            </CardContent>
          </Card>

          <Card className="border-blue-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.completed}</div>
              <p className="text-xs text-gray-500">This month</p>
            </CardContent>
          </Card>

          <Card className="border-red-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Cancelled</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
              <p className="text-xs text-gray-500">This month</p>
            </CardContent>
          </Card>
        </div>

        {/* Today's Schedule */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="border-blue-100">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <span>Today's Appointments</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {getTodaysAppointments().length > 0 ? (
                  getTodaysAppointments().map((appointment) => (
                    <div key={appointment.id} className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {appointment.start_time} - {appointment.patient_name}
                        </p>
                        <p className="text-xs text-gray-600">{appointment.appointment_type}</p>
                        {appointment.notes && (
                          <p className="text-xs text-gray-500 mt-1">{appointment.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(appointment.status)}>
                          {getStatusIcon(appointment.status)}
                          <span className="ml-1">{appointment.status}</span>
                        </Badge>
                        <Select value={appointment.status} onValueChange={(value) => handleUpdateAppointmentStatus(appointment.id, value)}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="no-show">No Show</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No appointments scheduled for today</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-100">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CalendarDays className="h-5 w-5 text-green-600" />
                <span>This Week</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getWeekAppointments().map((day) => (
                  <div key={day.date.toISOString()} className="flex items-center justify-between p-2 bg-green-50 rounded">
                    <div>
                      <p className="font-medium text-sm">{format(day.date, 'EEE, MMM d')}</p>
                      <p className="text-xs text-gray-600">{day.appointments.length} appointment(s)</p>
                    </div>
                    <Badge className="bg-green-100 text-green-800">{day.appointments.length}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Appointments */}
        <Card className="border-purple-100">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CalendarIcon className="h-5 w-5 text-purple-600" />
              <span>Upcoming Appointments</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {appointments
                .filter(a => new Date(a.appointment_date) > new Date())
                .slice(0, 10)
                .map((appointment) => (
                  <div key={appointment.id} className="flex items-center space-x-4 p-3 bg-purple-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium">{appointment.patient_name}</p>
                        <Badge className={getStatusColor(appointment.status)}>
                          {appointment.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {format(parseISO(appointment.appointment_date), 'MMM d, yyyy')} at {appointment.start_time}
                      </p>
                      <p className="text-xs text-gray-500">{appointment.appointment_type}</p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateAppointmentStatus(appointment.id, 'confirmed')}
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateAppointmentStatus(appointment.id, 'cancelled')}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ))}
              {appointments.filter(a => new Date(a.appointment_date) > new Date()).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No upcoming appointments</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 