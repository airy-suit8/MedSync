"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, ArrowRight, Users, Shield, Zap, MessageSquare, FileText, Camera, Microscope, Brain } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Image src="/medi.png" alt="MedSync Logo" width={32} height={32} />
            <span className="text-2xl font-bold text-gray-900">MedSync</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/login">
              <Button variant="outline" className="bg-white text-blue-600 border-blue-200 hover:bg-blue-50">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Revolutionizing Healthcare Communication
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Seamlessly connect scan labs, doctors, and patients through AI-enhanced, real-time healthcare collaboration
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-4">
              Start Your Journey
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose MedSync?</h2>
            <p className="text-lg text-gray-600">
              Our AI-enhanced platform ensures seamless, secure, and efficient communication across the entire healthcare ecosystem
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-blue-100 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Brain className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-lg">AI-Powered Analysis</CardTitle>
                <CardDescription>
                  Intelligent medical report analysis with automated insights and recommendations
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-green-100 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="text-lg">Enterprise Security</CardTitle>
                <CardDescription>
                  Seamless EHR integration with enterprise-grade security and compliance.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-purple-100 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle className="text-lg">Team Collaboration</CardTitle>
                <CardDescription>
                  Real-time collaboration between healthcare professionals and patients
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Healthcare Use Cases</h2>
            <p className="text-lg text-gray-600">From AI-enhanced patient interaction to remote consultations</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-blue-100">
              <CardHeader>
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                  <Brain className="h-5 w-5 text-blue-600" />
                </div>
                <CardTitle className="text-lg">AI Patient Assistant</CardTitle>
                <CardDescription>Intelligent guidance and symptom analysis before doctor review</CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-green-100">
              <CardHeader>
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <CardTitle className="text-lg">Smart Report Processing</CardTitle>
                <CardDescription>Labs upload scans → AI-enhanced reports with intelligent insights</CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-purple-100">
              <CardHeader>
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <CardTitle className="text-lg">AI-Generated Summaries</CardTitle>
                <CardDescription>Doctors input notes; AI generates focused summaries for patients</CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-orange-100">
              <CardHeader>
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-3">
                  <Camera className="h-5 w-5 text-orange-600" />
                </div>
                <CardTitle className="text-lg">Medicine Scanner</CardTitle>
                <CardDescription>Patients scan medicine labels; AI suggests verified alternatives</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Additional Features */}
      <section className="py-20 bg-white">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">AI-Enhanced Health Information</h2>
              <p className="text-lg text-gray-600 mb-6">
                Access reliable health information and get intelligent answers to your medical questions through our AI-powered knowledge base.
              </p>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <Activity className="h-3 w-3 text-green-600" />
                  </div>
                  <span className="text-gray-700">AI-powered medicine information and side effects</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <Activity className="h-3 w-3 text-green-600" />
                  </div>
                  <span className="text-gray-700">Intelligent treatment recommendations</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <Activity className="h-3 w-3 text-green-600" />
                  </div>
                  <span className="text-gray-700">AI-driven health education and preventive care</span>
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <div className="w-80 h-80 bg-gradient-to-br from-blue-100 to-green-100 rounded-full flex items-center justify-center">
                <Microscope className="h-32 w-32 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Ready to Transform Healthcare?</h2>
          <p className="text-lg text-gray-600 mb-8">
            Join thousands of healthcare professionals and patients already using MedSync
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-4">
              Get Started Today
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Image src="/medi.png" alt="MedSync Logo" width={32} height={32} />
                <span className="text-xl font-bold">MedSync</span>
              </div>
              <p className="text-gray-400">
                Revolutionizing healthcare communication through AI-enhanced, secure, real-time collaboration.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">For Patients</h3>
              <ul className="space-y-2 text-gray-400">
                <li>Health Records</li>
                <li>AI Health Assistant</li>
                <li>Medicine Information</li>
                <li>Appointment Management</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">For Doctors</h3>
              <ul className="space-y-2 text-gray-400">
                <li>Patient Management</li>
                <li>AI Report Analysis</li>
                <li>Team Communication</li>
                <li>Remote Consultations</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">For Labs</h3>
              <ul className="space-y-2 text-gray-400">
                <li>Result Upload</li>
                <li>Sample Management</li>
                <li>Doctor Communication</li>
                <li>Quality Control</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 MedSync. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
