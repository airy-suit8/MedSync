"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Activity, Users, FileText, MessageSquare, Calendar, Brain, Stethoscope, ClipboardList, Clock, AlertCircle, CheckCircle, Eye } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import Image from "next/image"
import Link from "next/link"
import NotificationBadge from "@/components/notification-badge"
import { format, parseISO } from "date-fns"

interface UrgentReview {
  id: string
  patient_name: string
  report_type: string
  description: string
  priority: 'urgent' | 'high' | 'normal'
  created_at: string
  status: string
}

interface AIInsight {
  id: string
  type: string
  title: string
  description: string
  created_at: string
  priority: string
}

interface DoctorStats {
  activePatients: number
  pendingReviews: number
  consultations: number
  aiInsights: number
}

export default function DoctorDashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [urgentReviews, setUrgentReviews] = useState<UrgentReview[]>([])
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([])
  const [stats, setStats] = useState<DoctorStats>({
    activePatients: 0,
    pendingReviews: 0,
    consultations: 0,
    aiInsights: 0
  })
  const [selectedReview, setSelectedReview] = useState<UrgentReview | null>(null)
  const [selectedInsight, setSelectedInsight] = useState<AIInsight | null>(null)
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

      // Check if user has doctor role
      if (user.user_metadata?.role !== "doctor") {
        router.push("/login")
        return
      }

      setUser(user)
      await loadDashboardData(user.id)
      setLoading(false)
    }

    checkUser()
  }, [router])

  const loadDashboardData = async (doctorId: string) => {
    const supabase = createClient()
    
    try {
      // Load appointments for today's consultations count
      const today = format(new Date(), 'yyyy-MM-dd')
      const { data: todayAppointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('appointment_date', today)
        .order('start_time', { ascending: true })

      // Load reports for pending reviews
      const { data: reports, error: reportsError } = await supabase
        .from('reports')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      // Load urgent reviews (reports with high priority)
      const { data: urgentReports, error: urgentError } = await supabase
        .from('reports')
        .select('*')
        .eq('doctor_id', doctorId)
        .in('priority', ['urgent', 'high'])
        .order('created_at', { ascending: false })
        .limit(5)

      // Calculate stats
      const consultations = todayAppointments?.length || 0
      const pendingReviews = reports?.length || 0
      const activePatients = Math.max(consultations * 3, 12) // Estimate based on consultations
      const aiInsights = Math.floor(Math.random() * 8) + 12 // Demo data for now

      setStats({
        activePatients,
        pendingReviews,
        consultations,
        aiInsights
      })

      // Build urgent reviews from real data
      const reviews: UrgentReview[] = []
      if (urgentReports && urgentReports.length > 0) {
        urgentReports.forEach(report => {
          reviews.push({
            id: report.id,
            patient_name: report.patient_name || 'Unknown Patient',
            report_type: report.report_type || 'Medical Report',
            description: report.description || 'Report requires review',
            priority: report.priority || 'normal',
            created_at: report.created_at,
            status: report.status
          })
        })
      } else {
        // Fallback demo data
        reviews.push(
          {
            id: 'demo-1',
            patient_name: 'John Doe',
            report_type: 'CT Scan',
            description: 'Abnormal findings detected by AI',
            priority: 'urgent',
            created_at: format(new Date(), 'yyyy-MM-dd'),
            status: 'pending'
          },
          {
            id: 'demo-2',
            patient_name: 'Sarah Smith',
            report_type: 'Blood Work',
            description: 'Elevated markers require review',
            priority: 'high',
            created_at: format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
            status: 'pending'
          },
          {
            id: 'demo-3',
            patient_name: 'Mike Johnson',
            report_type: 'X-Ray',
            description: 'Routine follow-up review',
            priority: 'normal',
            created_at: format(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
            status: 'pending'
          }
        )
      }
      setUrgentReviews(reviews)

      // Build AI insights (demo data for now)
      const insights: AIInsight[] = [
        {
          id: 'insight-1',
          type: 'pattern',
          title: 'Pattern Recognition Alert',
          description: 'Similar cases suggest early intervention',
          created_at: format(new Date(), 'yyyy-MM-dd'),
          priority: 'high'
        },
        {
          id: 'insight-2',
          type: 'treatment',
          title: 'Treatment Recommendation',
          description: 'AI suggests alternative therapy option',
          created_at: format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
          priority: 'medium'
        },
        {
          id: 'insight-3',
          type: 'risk',
          title: 'Risk Assessment',
          description: 'Patient risk profile updated',
          created_at: format(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
          priority: 'low'
        }
      ]
      setAiInsights(insights)

    } catch (error) {
      console.error('Error loading dashboard data:', error)
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  }

  const handleReviewClick = (review: UrgentReview) => {
    setSelectedReview(review)
  }

  const handleInsightClick = (insight: AIInsight) => {
    setSelectedInsight(insight)
  }

  const handleViewReport = (reviewId: string) => {
    router.push(`/doctor-dashboard/reports?review=${reviewId}`)
  }

  const handleViewInsight = (insightId: string) => {
    router.push(`/doctor-dashboard/ai-assistant?insight=${insightId}`)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-50 border-red-200'
      case 'high': return 'bg-yellow-50 border-yellow-200'
      case 'normal': return 'bg-blue-50'
      default: return 'bg-gray-50'
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent': return <Badge className="bg-red-100 text-red-800">Urgent</Badge>
      case 'high': return <Badge className="bg-yellow-100 text-yellow-800">High Priority</Badge>
      case 'normal': return <Badge className="bg-blue-100 text-blue-800">Normal</Badge>
      default: return <Badge className="bg-gray-100 text-gray-800">{priority}</Badge>
    }
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'pattern': return <Brain className="h-5 w-5 text-green-600" />
      case 'treatment': return <Brain className="h-5 w-5 text-purple-600" />
      case 'risk': return <Brain className="h-5 w-5 text-orange-600" />
      default: return <Brain className="h-5 w-5 text-blue-600" />
    }
  }

  const getInsightBgColor = (type: string) => {
    switch (type) {
      case 'pattern': return 'bg-green-50'
      case 'treatment': return 'bg-purple-50'
      case 'risk': return 'bg-orange-50'
      default: return 'bg-blue-50'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Image src="/medi.png" alt="MedSync Logo" width={32} height={32} />
            <span className="text-2xl font-bold text-gray-900">MedSync</span>
            <Badge className="bg-blue-100 text-blue-800">Doctor Portal</Badge>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">{user?.user_metadata?.name} - Doctor</span>
            <Link href="/doctor-dashboard/notifications">
              <NotificationBadge userId={user?.id} role="doctor" />
            </Link>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Doctor Dashboard</h1>
          <p className="text-gray-600">
            Manage patient consultations, review reports, and collaborate with your healthcare team.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-blue-100 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/doctor-dashboard/reports')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Active Patients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.activePatients}</div>
              <p className="text-xs text-gray-500">Under care</p>
            </CardContent>
          </Card>

          <Card className="border-green-100 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/doctor-dashboard/reports')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.pendingReviews}</div>
              <p className="text-xs text-gray-500">Reports to review</p>
            </CardContent>
          </Card>

          <Card className="border-purple-100 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/doctor-dashboard/schedule')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Consultations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.consultations}</div>
              <p className="text-xs text-gray-500">Today</p>
            </CardContent>
          </Card>

          <Card className="border-orange-100 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/doctor-dashboard/ai-assistant')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">AI Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.aiInsights}</div>
              <p className="text-xs text-gray-500">Generated today</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="border-green-100 hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <FileText className="h-10 w-10 text-green-600 mb-2" />
              <CardTitle>Patient Management & Report Review</CardTitle>
              <CardDescription>Manage patient roster and review lab results with AI assistance</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/doctor-dashboard/reports">
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                  Manage Patients & Reports
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-purple-100 hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <MessageSquare className="h-10 w-10 text-purple-600 mb-2" />
              <CardTitle>Team Communication</CardTitle>
              <CardDescription>Collaborate with labs, specialists, and patients securely</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/doctor-dashboard/communication">
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                  Open Messages
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-orange-100 hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <Brain className="h-10 w-10 text-orange-600 mb-2" />
              <CardTitle>AI Diagnostic Assistant</CardTitle>
              <CardDescription>Get AI-powered insights and diagnostic suggestions</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/doctor-dashboard/ai-assistant">
                <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white">
                  AI Assistant
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-pink-100 hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <Calendar className="h-10 w-10 text-pink-600 mb-2" />
              <CardTitle>Schedule Management</CardTitle>
              <CardDescription>Manage appointments and consultation schedules</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/doctor-dashboard/schedule">
                <Button className="w-full bg-pink-600 hover:bg-pink-700 text-white">
                  View Schedule
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-blue-100 hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <Users className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>Patient Consultations</CardTitle>
              <CardDescription>Conduct virtual consultations and patient assessments</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/doctor-dashboard/consultations">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  Start Consultation
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-indigo-100 hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <Stethoscope className="h-10 w-10 text-indigo-600 mb-2" />
              <CardTitle>Medical Records</CardTitle>
              <CardDescription>Access comprehensive patient medical histories</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/doctor-dashboard/medical-records">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                  View Records
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity & Urgent Items */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-blue-100">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Urgent Reviews</span>
                <Link href="/doctor-dashboard/reports">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </CardTitle>
              <CardDescription>Reports requiring immediate attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {urgentReviews.length > 0 ? (
                  urgentReviews.map((review) => (
                    <div 
                      key={review.id} 
                      className={`flex items-center space-x-4 p-3 ${getPriorityColor(review.priority)} rounded-lg border cursor-pointer hover:shadow-md transition-shadow`}
                      onClick={() => handleReviewClick(review)}
                    >
                      <ClipboardList className="h-5 w-5 text-gray-600" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{review.patient_name} - {review.report_type}</p>
                        <p className="text-sm text-gray-600">{review.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(parseISO(review.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getPriorityBadge(review.priority)}
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleViewReport(review.id)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <ClipboardList className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No urgent reviews</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-100">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Recent AI Insights</span>
                <Link href="/doctor-dashboard/ai-assistant">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </CardTitle>
              <CardDescription>Latest AI-generated diagnostic insights</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aiInsights.length > 0 ? (
                  aiInsights.map((insight) => (
                    <div 
                      key={insight.id} 
                      className={`flex items-center space-x-4 p-3 ${getInsightBgColor(insight.type)} rounded-lg cursor-pointer hover:shadow-md transition-shadow`}
                      onClick={() => handleInsightClick(insight)}
                    >
                      {getInsightIcon(insight.type)}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{insight.title}</p>
                        <p className="text-sm text-gray-600">{insight.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(parseISO(insight.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className="bg-green-100 text-green-800">Insight</Badge>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleViewInsight(insight.id)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Brain className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No AI insights available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Review Detail Modal */}
      <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review Details</DialogTitle>
            <DialogDescription>
              {selectedReview?.patient_name} - {selectedReview?.report_type}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="font-medium">Description:</p>
              <p className="text-sm text-gray-600">{selectedReview?.description}</p>
            </div>
            <div>
              <p className="font-medium">Priority:</p>
              {getPriorityBadge(selectedReview?.priority || 'normal')}
            </div>
            <div>
              <p className="font-medium">Date:</p>
              <p className="text-sm text-gray-600">
                {selectedReview?.created_at ? format(parseISO(selectedReview.created_at), 'MMM d, yyyy') : 'N/A'}
              </p>
            </div>
            <div className="flex space-x-2">
              <Button 
                className="flex-1" 
                onClick={() => selectedReview && handleViewReport(selectedReview.id)}
              >
                View Full Report
              </Button>
              <Button variant="outline" onClick={() => setSelectedReview(null)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Insight Detail Modal */}
      <Dialog open={!!selectedInsight} onOpenChange={() => setSelectedInsight(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>AI Insight Details</DialogTitle>
            <DialogDescription>
              {selectedInsight?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="font-medium">Description:</p>
              <p className="text-sm text-gray-600">{selectedInsight?.description}</p>
            </div>
            <div>
              <p className="font-medium">Type:</p>
              <Badge className="bg-green-100 text-green-800">{selectedInsight?.type}</Badge>
            </div>
            <div>
              <p className="font-medium">Date:</p>
              <p className="text-sm text-gray-600">
                {selectedInsight?.created_at ? format(parseISO(selectedInsight.created_at), 'MMM d, yyyy') : 'N/A'}
              </p>
            </div>
            <div className="flex space-x-2">
              <Button 
                className="flex-1" 
                onClick={() => selectedInsight && handleViewInsight(selectedInsight.id)}
              >
                View in AI Assistant
              </Button>
              <Button variant="outline" onClick={() => setSelectedInsight(null)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
