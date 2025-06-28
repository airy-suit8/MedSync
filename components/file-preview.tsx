"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Image as ImageIcon, Download, Eye, EyeOff, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase"

interface FilePreviewProps {
  fileName: string
  originalName: string
  patientId: string
}

export default function FilePreview({ fileName, originalName, patientId }: FilePreviewProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [isSampleData, setIsSampleData] = useState(false)

  const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(originalName)
  const isPDF = /\.pdf$/i.test(originalName)

  // Check if this is sample data (files that don't exist in storage)
  const isSampleFile = fileName.includes('1703123456789') || 
                      fileName.includes('1703123456790') || 
                      fileName.includes('1703123456791') || 
                      fileName.includes('1703123456792')

  const loadFile = async () => {
    if (fileUrl) return

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      
      // Check if this is sample data
      if (isSampleFile) {
        setIsSampleData(true)
        setError('This is sample data. In a real scenario, the actual file would be available here.')
        setLoading(false)
        return
      }
      
      // First check if the file exists
      const { data: fileList, error: listError } = await supabase.storage
        .from('reports')
        .list('', {
          search: fileName
        })

      if (listError) {
        throw new Error('Failed to check file existence')
      }

      if (!fileList || fileList.length === 0) {
        throw new Error('File not found in storage. This may be sample data or the file was not uploaded.')
      }

      const { data, error } = await supabase.storage
        .from('reports')
        .createSignedUrl(fileName, 3600) // 1 hour expiry

      if (error) {
        throw error
      }

      setFileUrl(data.signedUrl)
    } catch (err: any) {
      console.error('Error loading file:', err)
      setError(err.message || 'Failed to load file. The file may not exist or you may not have permission to access it.')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      
      // Check if this is sample data
      if (isSampleFile) {
        setIsSampleData(true)
        setError('This is sample data. In a real scenario, you would be able to download the actual file.')
        setLoading(false)
        return
      }
      
      // First check if the file exists
      const { data: fileList, error: listError } = await supabase.storage
        .from('reports')
        .list('', {
          search: fileName
        })

      if (listError) {
        throw new Error('Failed to check file existence')
      }

      if (!fileList || fileList.length === 0) {
        throw new Error('File not found in storage. This may be sample data or the file was not uploaded.')
      }

      const { data, error } = await supabase.storage
        .from('reports')
        .download(fileName)

      if (error) {
        throw error
      }

      // Create download link
      const url = window.URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = originalName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('Error downloading file:', err)
      setError(err.message || 'Failed to download file. The file may not exist or you may not have permission to access it.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {isImage ? (
              <ImageIcon className="h-8 w-8 text-blue-600" />
            ) : isPDF ? (
              <FileText className="h-8 w-8 text-red-600" />
            ) : (
              <FileText className="h-8 w-8 text-gray-600" />
            )}
            <div>
              <h3 className="font-semibold text-gray-900">{originalName}</h3>
              <p className="text-sm text-gray-600">Patient ID: {patientId}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              {isImage ? 'Image' : isPDF ? 'PDF' : 'Document'}
            </Badge>
            {isSampleFile && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                Sample Data
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Sample Data Notice */}
          {isSampleData && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <p className="text-sm text-yellow-800">
                  This is sample data for demonstration purposes. In a real scenario, actual medical reports would be uploaded and accessible here.
                </p>
              </div>
            </div>
          )}

          {/* File Preview */}
          {showPreview && fileUrl && (
            <div className="border rounded-lg p-4 bg-gray-50">
              {isImage ? (
                <div className="flex justify-center">
                  <img 
                    src={fileUrl} 
                    alt={originalName}
                    className="max-w-full max-h-96 object-contain rounded-lg shadow-sm"
                  />
                </div>
              ) : isPDF ? (
                <div className="flex justify-center">
                  <iframe
                    src={fileUrl}
                    className="w-full h-96 border rounded-lg"
                    title={originalName}
                  />
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Preview not available for this file type</p>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && !isSampleData && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2">
            {!fileUrl && !loading && !isSampleData && (
              <Button 
                onClick={loadFile}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Eye className="h-4 w-4 mr-2" />
                Load Preview
              </Button>
            )}
            
            {loading && (
              <Button disabled className="bg-gray-400">
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Loading...
              </Button>
            )}

            {fileUrl && !isSampleData && (
              <Button 
                onClick={() => setShowPreview(!showPreview)}
                variant="outline"
              >
                {showPreview ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Hide Preview
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Show Preview
                  </>
                )}
              </Button>
            )}

            <Button 
              onClick={handleDownload}
              variant="outline"
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={isSampleData}
            >
              <Download className="h-4 w-4 mr-2" />
              {isSampleData ? 'Sample Data' : 'Download'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 