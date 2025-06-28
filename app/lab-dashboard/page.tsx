"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Activity, Upload, FileText, MessageSquare, Microscope, FlaskConical, Camera } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"

export default function LabDashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
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

      // Check if user has lab role
      if (user.user_metadata?.role !== "lab") {
        router.push("/login")
        return
      }

      setUser(user)
      setLoading(false)
    }

    checkUser()
  }, [router])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Image src="/medi.png" alt="MedSync Logo" width={32} height={32} />
            <span className="text-2xl font-bold text-gray-900">MedSync</span>
            <Badge className="bg-purple-100 text-purple-800">Lab Portal</Badge>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">{user?.user_metadata?.name} - Lab Tech</span>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Laboratory Dashboard</h1>
          <p className="text-gray-600">
            Upload test results, manage samples, and communicate with healthcare providers.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-blue-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">18</div>
              <p className="text-xs text-gray-500">In queue</p>
            </CardContent>
          </Card>

          <Card className="border-green-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Completed Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">32</div>
              <p className="text-xs text-gray-500">Tests processed</p>
            </CardContent>
          </Card>

          <Card className="border-purple-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Doctor Raised Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">5</div>
              <p className="text-xs text-gray-500">Tickets from doctors needing lab action</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="border-blue-100 hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <Upload className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>Upload Results</CardTitle>
              <CardDescription>Upload test results, scans, and reports to the system</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/lab-dashboard/upload">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">Upload Files</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-green-100 hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <Microscope className="h-10 w-10 text-green-600 mb-2" />
              <CardTitle>Sample Management</CardTitle>
              <CardDescription>Track and manage laboratory samples and specimens</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/lab-dashboard/samples">
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white">Manage Samples</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-purple-100 hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <MessageSquare className="h-10 w-10 text-purple-600 mb-2" />
              <CardTitle>Healthcare Communication</CardTitle>
              <CardDescription>Chat with doctors for specific cases and coordinate with patients</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/lab-dashboard/communication">
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">Open Communication</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-pink-100 hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <Camera className="h-10 w-10 text-pink-600 mb-2" />
              <CardTitle>Imaging Center</CardTitle>
              <CardDescription>Manage X-rays, CT scans, and other medical imaging</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/lab-dashboard/imaging">
                <Button className="w-full bg-pink-600 hover:bg-pink-700 text-white">Imaging Portal</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity & Urgent Items */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-blue-100">
            <CardHeader>
              <CardTitle>Urgent Test Results</CardTitle>
              <CardDescription>Results requiring immediate doctor notification</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-4 p-3 bg-red-50 rounded-lg border border-red-200">
                  <FlaskConical className="h-5 w-5 text-red-600" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Patient ID: 12345 - Cardiac Enzymes</p>
                    <p className="text-sm text-gray-600">Elevated troponin levels detected</p>
                  </div>
                  <Badge className="bg-red-100 text-red-800">Critical</Badge>
                </div>

                <div className="flex items-center space-x-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <Microscope className="h-5 w-5 text-yellow-600" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Patient ID: 67890 - Blood Culture</p>
                    <p className="text-sm text-gray-600">Positive culture growth identified</p>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-800">Urgent</Badge>
                </div>

                <div className="flex items-center space-x-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <Camera className="h-5 w-5 text-orange-600" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Patient ID: 11111 - Chest X-Ray</p>
                    <p className="text-sm text-gray-600">Abnormal findings require review</p>
                  </div>
                  <Badge className="bg-orange-100 text-orange-800">High Priority</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-100">
            <CardHeader>
              <CardTitle>Recent Uploads</CardTitle>
              <CardDescription>Latest test results uploaded to the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-4 p-3 bg-green-50 rounded-lg">
                  <Upload className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Complete Blood Count - Batch 001</p>
                    <p className="text-sm text-gray-600">15 results uploaded successfully</p>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Completed</Badge>
                </div>

                <div className="flex items-center space-x-4 p-3 bg-blue-50 rounded-lg">
                  <Upload className="h-5 w-5 text-blue-600" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Lipid Panel - Batch 002</p>
                    <p className="text-sm text-gray-600">8 results uploaded successfully</p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800">Completed</Badge>
                </div>

                <div className="flex items-center space-x-4 p-3 bg-purple-50 rounded-lg">
                  <Upload className="h-5 w-5 text-purple-600" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Radiology Reports - Morning</p>
                    <p className="text-sm text-gray-600">12 imaging reports processed</p>
                  </div>
                  <Badge className="bg-purple-100 text-purple-800">Completed</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
