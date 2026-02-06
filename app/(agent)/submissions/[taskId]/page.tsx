"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layouts/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, AlertCircle, Send, Plus, X, Upload, FileIcon, Loader2, Image as ImageIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"

interface BugReport {
  title: string
  severity: string
  steps: string
  screenshot: string
}

export default function SubmitResultsPage({
  params,
}: {
  params: Promise<{ taskId: string }>
}) {
  const { taskId } = use(params)
  const router = useRouter()
  const [task, setTask] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  // Form state
  const [feedback, setFeedback] = useState("")
  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<Array<{
    url: string
    filename: string
    size: number
    contentType: string
  }>>([])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [bugReports, setBugReports] = useState<BugReport[]>([])
  const [rating, setRating] = useState<number>(5)
  const [timeSpent, setTimeSpent] = useState<number>(0)

  useEffect(() => {
    fetchTaskDetails()
  }, [taskId])

  const fetchTaskDetails = async () => {
    try {
      // In a real app, fetch task details from API
      // For now, we'll just mark as loaded
      setLoading(false)
    } catch (error) {
      setError("Failed to load task details")
      setLoading(false)
    }
  }

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (uploadedFiles.length + files.length > 10) {
      toast.error("Maximum 10 files per submission")
      return
    }

    setUploading(true)
    const newFiles: typeof uploadedFiles = []

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData()
        formData.append("file", file)

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        if (!res.ok) {
          const data = await res.json()
          toast.error(data.error || `Failed to upload ${file.name}`)
          continue
        }

        const data = await res.json()
        newFiles.push(data)
      } catch {
        toast.error(`Failed to upload ${file.name}`)
      }
    }

    setUploadedFiles((prev) => [...prev, ...newFiles])
    setUploading(false)
  }

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const isImageFile = (contentType: string) => contentType.startsWith("image/")

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const totalUploadSize = uploadedFiles.reduce((sum, f) => sum + f.size, 0)

  const addBugReport = () => {
    setBugReports([
      ...bugReports,
      { title: "", severity: "MEDIUM", steps: "", screenshot: "" }
    ])
  }

  const updateBugReport = (index: number, field: keyof BugReport, value: string) => {
    const newBugReports = [...bugReports]
    newBugReports[index][field] = value
    setBugReports(newBugReports)
  }

  const removeBugReport = (index: number) => {
    setBugReports(bugReports.filter((_, i) => i !== index))
  }

  const validateForm = () => {
    if (feedback.trim().length < 50) {
      setError("Feedback must be at least 50 characters")
      return false
    }

    if (uploadedFiles.length === 0) {
      setError("Please upload at least one file as evidence")
      return false
    }

    setError("")
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setSubmitting(true)
    setError("")

    try {
      const validBugReports = bugReports.filter(bug => bug.title && bug.steps)

      const res = await fetch(`/api/agent/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: feedback.trim(),
          screenshots: uploadedFiles.map(f => f.url),
          bugReports: validBugReports.length > 0 ? validBugReports : undefined,
          rating,
          duration: timeSpent * 60, // Convert minutes to seconds
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit')
      }

      toast.success("Submission successful! Awaiting creator review.")
      router.push('/my-tasks')
    } catch (err: any) {
      setError(err.message || "Failed to submit. Please try again.")
      toast.error(err.message || "Submission failed")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Loading task details...</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link href="/my-tasks">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to My Tasks
          </Link>
        </Button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Submit Task Results</h1>
          <p className="mt-2 text-muted-foreground">
            Provide detailed feedback to maximize approval chances
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Feedback */}
            <Card>
              <CardHeader>
                <CardTitle>Task Feedback *</CardTitle>
                <CardDescription>
                  Describe your work in detail (minimum 50 characters)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Describe what you did, what worked well, any issues found, and overall impressions...&#10;&#10;Example:&#10;Tested the authentication system thoroughly. Signup flow works smoothly with proper email validation. Login is fast and reliable. Found minor UI issue on mobile - 'Forgot Password' link is hard to see. Overall solid implementation."
                  rows={8}
                  required
                  disabled={submitting}
                />
                <div className="flex items-center justify-between text-sm">
                  <span className={feedback.length < 50 ? "text-destructive" : "text-muted-foreground"}>
                    {feedback.length} / 50 characters minimum
                  </span>
                  <span className="text-muted-foreground">
                    {feedback.split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Evidence Files */}
            <Card>
              <CardHeader>
                <CardTitle>Evidence Files *</CardTitle>
                <CardDescription>
                  Upload screenshots, documents, or code files (max 10 files, 50MB each)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Drop zone */}
                <div
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary/50"
                  } ${uploading ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragActive(false)
                    handleFileUpload(e.dataTransfer.files)
                  }}
                  onClick={() => {
                    const input = document.createElement("input")
                    input.type = "file"
                    input.multiple = true
                    input.accept = "image/*,.pdf,.txt,.csv,.doc,.docx,.zip,.gz,.tar,.js,.ts,.html,.css,.json,.py"
                    input.onchange = (e) => handleFileUpload((e.target as HTMLInputElement).files)
                    input.click()
                  }}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Uploading...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium">Drop files here or click to browse</p>
                      <p className="text-xs text-muted-foreground">
                        Images, documents, archives, or code files
                      </p>
                    </div>
                  )}
                </div>

                {/* Uploaded files grid */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                      >
                        {isImageFile(file.contentType) ? (
                          <div className="relative h-12 w-12 rounded overflow-hidden flex-shrink-0 bg-muted">
                            <img
                              src={file.url}
                              alt={file.filename}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-12 w-12 rounded flex items-center justify-center bg-muted flex-shrink-0">
                            <FileIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.filename}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0 h-8 w-8"
                          onClick={() => removeFile(index)}
                          disabled={submitting}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>{uploadedFiles.length}/10 files</span>
                      <span>Total: {formatFileSize(totalUploadSize)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bug Reports */}
            <Card>
              <CardHeader>
                <CardTitle>Bug Reports (Optional)</CardTitle>
                <CardDescription>
                  Document any bugs you found with reproduction steps
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {bugReports.map((bug, index) => (
                  <div key={index} className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">Bug #{index + 1}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeBugReport(index)}
                        disabled={submitting}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Bug Title</Label>
                      <Input
                        placeholder="e.g., Login button not working on mobile"
                        value={bug.title}
                        onChange={(e) => updateBugReport(index, 'title', e.target.value)}
                        disabled={submitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Severity</Label>
                      <Select
                        value={bug.severity}
                        onValueChange={(value) => updateBugReport(index, 'severity', value)}
                        disabled={submitting}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">Low</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="CRITICAL">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Steps to Reproduce</Label>
                      <Textarea
                        placeholder="1. Navigate to login page&#10;2. Enter credentials&#10;3. Click submit&#10;4. Button doesn't respond"
                        value={bug.steps}
                        onChange={(e) => updateBugReport(index, 'steps', e.target.value)}
                        rows={4}
                        disabled={submitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Screenshot URL (Optional)</Label>
                      <Input
                        type="url"
                        placeholder="https://imgur.com/bug001.png"
                        value={bug.screenshot}
                        onChange={(e) => updateBugReport(index, 'screenshot', e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addBugReport}
                  disabled={submitting}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Bug Report
                </Button>
              </CardContent>
            </Card>

            {/* Additional Info */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="rating">Overall Rating (1-10)</Label>
                    <Input
                      id="rating"
                      type="number"
                      min="1"
                      max="10"
                      value={rating}
                      onChange={(e) => setRating(parseInt(e.target.value) || 5)}
                      disabled={submitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeSpent">Time Spent (minutes)</Label>
                    <Input
                      id="timeSpent"
                      type="number"
                      min="1"
                      value={timeSpent || ''}
                      onChange={(e) => setTimeSpent(parseInt(e.target.value) || 0)}
                      placeholder="e.g., 20"
                      disabled={submitting}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submission Tips */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base">Tips for High Approval Rate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <p>Write detailed feedback (100+ words recommended)</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <p>Include multiple screenshots showing key steps</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <p>Document bugs with clear reproduction steps</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <p>Be honest and constructive in your feedback</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <p>Realistic time spent (not too fast or slow)</p>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={submitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || feedback.length < 50 || uploadedFiles.length === 0}
                className="flex-1"
              >
                {submitting ? (
                  "Submitting..."
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Results
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  )
}
