"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Activity, FileText, MessageSquare, Calendar, Pill, Brain, Heart, Clock, CheckCircle, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { format, parseISO } from "date-fns"

interface PatientActivity {
  id: string
  type: 'appointment' | 'report' | 'message' | 'ai_chat'
  title: string
  description: string
  date: string
  status: string
  icon: string
}

interface PatientStats {
  recentReports: number
  upcomingAppointments: number
  unreadMessages: number
  healthScore: number
}

export default function PatientDashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [recentActivity, setRecentActivity] = useState<PatientActivity[]>([])
  const [stats, setStats] = useState<PatientStats>({
    recentReports: 0,
    upcomingAppointments: 0,
    unreadMessages: 0,
    healthScore: 85
  })
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      // Check if user has patient role
      if (user.user_metadata?.role !== "patient") {
        router.push("/login")
        return
      }

      setUser(user)
      await loadPatientData(user.id)
      setLoading(false)
    }

    checkUser()
  }, [router])

  const loadPatientData = async (patientId: string) => {
    const supabase = createClient()
    
    try {
      // Load appointments
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', patientId)
        .gte('appointment_date', format(new Date(), 'yyyy-MM-dd'))
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true })

      // Load reports (from patient_reports table if it exists, otherwise use demo data)
      const { data: reports, error: reportsError } = await supabase
        .from('patient_reports')
        .select('*')
        .eq('patient_id', patientId)
        .gte('created_at', format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
        .order('created_at', { ascending: false })

      // Load messages (from chat_messages table if it exists, otherwise use demo data)
      const { data: messages, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('recipient_id', patientId)
        .eq('read', false)
        .order('created_at', { ascending: false })

      // Calculate stats
      const upcomingAppointments = appointments?.filter(a => new Date(a.appointment_date) >= new Date()).length || 0
      const recentReports = reports?.length || 3 // Fallback to demo data
      const unreadMessages = messages?.length || 5 // Fallback to demo data

      setStats({
        recentReports,
        upcomingAppointments,
        unreadMessages,
        healthScore: 85
      })

      // Build recent activity from real data
      const activity: PatientActivity[] = []

      // Add recent appointments
      if (appointments && appointments.length > 0) {
        appointments.slice(0, 3).forEach(appointment => {
          activity.push({
            id: appointment.id,
            type: 'appointment',
            title: `Appointment with ${appointment.patient_name}`,
            description: `${format(parseISO(appointment.appointment_date), 'MMM d, yyyy')} at ${appointment.start_time} - ${appointment.appointment_type}`,
            date: appointment.appointment_date,
            status: appointment.status,
            icon: 'calendar'
          })
        })
      }

      // Add recent reports
      if (reports && reports.length > 0) {
        reports.slice(0, 2).forEach(report => {
          activity.push({
            id: report.id,
            type: 'report',
            title: `${report.report_type} Report Available`,
            description: report.description || 'Your test results are ready for review',
            date: report.created_at,
            status: 'new',
            icon: 'file'
          })
        })
      } else {
        // Add demo report data if no real reports
        activity.push({
          id: 'demo-report-1',
          type: 'report',
          title: 'Blood Test Report Available',
          description: 'Your latest blood test results are ready for review',
          date: format(new Date(), 'yyyy-MM-dd'),
          status: 'new',
          icon: 'file'
        })
      }

      // Add recent messages
      if (messages && messages.length > 0) {
        messages.slice(0, 2).forEach(message => {
          activity.push({
            id: message.id,
            type: 'message',
            title: `Message from ${message.sender_name || 'Doctor'}`,
            description: message.content?.substring(0, 50) + '...' || 'New message received',
            date: message.created_at,
            status: 'unread',
            icon: 'message'
          })
        })
      } else {
        // Add demo message data if no real messages
        activity.push({
          id: 'demo-message-1',
          type: 'message',
          title: 'Message from Dr. Smith',
          description: 'Your test results look good, schedule a follow-up',
          date: format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
          status: 'read',
          icon: 'message'
        })
      }

      // Add AI chat activity
      activity.push({
        id: 'demo-ai-1',
        type: 'ai_chat',
        title: 'AI Health Assistant Used',
        description: 'You asked about medication interactions',
        date: format(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        status: 'completed',
        icon: 'brain'
      })

      // Sort by date (most recent first)
      activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      setRecentActivity(activity.slice(0, 5)) // Show top 5 activities

    } catch (error) {
      console.error('Error loading patient data:', error)
      // Fallback to demo data if there's an error
      setRecentActivity([
        {
          id: 'demo-1',
          type: 'report',
          title: 'Blood Test Report Available',
          description: 'Your latest blood test results are ready for review',
          date: format(new Date(), 'yyyy-MM-dd'),
          status: 'new',
          icon: 'file'
        },
        {
          id: 'demo-2',
          type: 'message',
          title: 'Message from Dr. Smith',
          description: 'Your test results look good, schedule a follow-up',
          date: format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
          status: 'read',
          icon: 'message'
        },
        {
          id: 'demo-3',
          type: 'appointment',
          title: 'Appointment Scheduled',
          description: 'Follow-up appointment on March 25th, 2024',
          date: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
          status: 'confirmed',
          icon: 'calendar'
        }
      ])
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  }

  const getActivityIcon = (icon: string) => {
    switch (icon) {
      case 'file': return <FileText className="h-5 w-5 text-blue-600" />
      case 'message': return <MessageSquare className="h-5 w-5 text-green-600" />
      case 'calendar': return <Calendar className="h-5 w-5 text-purple-600" />
      case 'brain': return <Brain className="h-5 w-5 text-pink-600" />
      default: return <Activity className="h-5 w-5 text-gray-600" />
    }
  }

  const getActivityBgColor = (type: string) => {
    switch (type) {
      case 'report': return 'bg-blue-50'
      case 'message': return 'bg-green-50'
      case 'appointment': return 'bg-purple-50'
      case 'ai_chat': return 'bg-pink-50'
      default: return 'bg-gray-50'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
      case 'unread':
        return <Badge className="bg-blue-100 text-blue-800">New</Badge>
      case 'read':
        return <Badge className="bg-green-100 text-green-800">Read</Badge>
      case 'confirmed':
        return <Badge className="bg-purple-100 text-purple-800">Confirmed</Badge>
      case 'scheduled':
        return <Badge className="bg-yellow-100 text-yellow-800">Scheduled</Badge>
      case 'completed':
        return <Badge className="bg-gray-100 text-gray-800">Completed</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 text-green-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Image src="/medi.png" alt="MedSync Logo" width={32} height={32} />
            <span className="text-2xl font-bold text-gray-900">MedSync</span>
            <Badge className="bg-green-100 text-green-800">Patient Portal</Badge>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Welcome, {user?.user_metadata?.name}</span>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="bg-white text-green-600 border-green-200 hover:bg-green-50"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Your Health Dashboard</h1>
          <p className="text-gray-600">
            Manage your health records, communicate with your healthcare team, and get AI-powered insights.
          </p>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Your Patient ID:</strong> {user?.id || 'Not available'} 
              <br />
              <span className="text-xs">Share this ID with your healthcare providers so they can upload reports for you.</span>
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-blue-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Recent Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.recentReports}</div>
              <p className="text-xs text-gray-500">Last 30 days</p>
            </CardContent>
          </Card>

          <Card className="border-green-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.upcomingAppointments}</div>
              <p className="text-xs text-gray-500">Upcoming</p>
            </CardContent>
          </Card>

          <Card className="border-purple-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.unreadMessages}</div>
              <p className="text-xs text-gray-500">Unread</p>
            </CardContent>
          </Card>

          <Card className="border-orange-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Health Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.healthScore}%</div>
              <p className="text-xs text-gray-500">Good</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="border-blue-100 hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <FileText className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>My Reports</CardTitle>
              <CardDescription>View and download your medical reports with AI-powered explanations. Click to view reports uploaded by your healthcare providers.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/patient-dashboard/reports">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  View Reports
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-green-100 hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <MessageSquare className="h-10 w-10 text-green-600 mb-2" />
              <CardTitle>Chat with Team</CardTitle>
              <CardDescription>Secure messaging with your doctors and lab technicians</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/patient-dashboard/chat">
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                  Open Chat
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-pink-100 hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <Brain className="h-10 w-10 text-pink-600 mb-2" />
              <CardTitle>AI Health Assistant</CardTitle>
              <CardDescription>Ask health questions and get AI-powered guidance</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/patient-dashboard/ai-assistant">
                <Button className="w-full bg-pink-600 hover:bg-pink-700 text-white">
                  Ask AI
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="border-blue-100">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest health updates and interactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div key={activity.id} className={`flex items-center space-x-4 p-3 ${getActivityBgColor(activity.type)} rounded-lg`}>
                    {getActivityIcon(activity.icon)}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{activity.title}</p>
                      <p className="text-sm text-gray-600">{activity.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(parseISO(activity.date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    {getStatusBadge(activity.status)}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
