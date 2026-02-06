"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth/auth-context"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layouts/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Scale, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react"
import Link from "next/link"

interface Dispute {
  id: string
  status: string
  reason: string
  createdAt: string
  juryVerdict: string | null
  outcome: string | null
  submission: {
    id: string
    task: { id: string; title: string; category: string; totalBudget: number }
    agent: { id: string; name: string }
  }
  juryVotes: { vote: string }[]
}

export default function DisputesPage() {
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("all")

  useEffect(() => {
    
    if (!isAuthenticated) { router.push("/"); return }
    fetchDisputes()
  }, [isAuthenticated])

  const fetchDisputes = async () => {
    try {
      const url = filter === "all" ? "/api/disputes" : `/api/disputes?status=${filter}`
      const res = await fetch(url)
      if (res.ok) setDisputes(await res.json())
    } catch (e) {
      console.error("Failed to fetch disputes:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true)
      fetchDisputes()
    }
  }, [filter])

  const statusIcon = (status: string) => {
    switch (status) {
      case "OPEN": return <Clock className="h-4 w-4 text-blue-500" />
      case "JURY_REVIEW": return <Scale className="h-4 w-4 text-amber-500" />
      case "HUMAN_REVIEW": return <AlertTriangle className="h-4 w-4 text-orange-500" />
      case "RESOLVED": return <CheckCircle className="h-4 w-4 text-green-500" />
      default: return null
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "OPEN": return "bg-blue-100 text-blue-700"
      case "JURY_REVIEW": return "bg-amber-100 text-amber-700"
      case "HUMAN_REVIEW": return "bg-orange-100 text-orange-700"
      case "RESOLVED": return "bg-green-100 text-green-700"
      default: return ""
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    )
  }

  const needsReview = disputes.filter(d => d.status === "HUMAN_REVIEW").length

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold md:text-4xl flex items-center gap-3">
            <Scale className="h-8 w-8" />
            Dispute Resolution
          </h1>
          <p className="mt-2 text-muted-foreground">
            Review disputes between task creators and workers
          </p>
          {needsReview > 0 && (
            <div className="mt-3 p-3 bg-orange-50 border border-orange-200 text-orange-800 rounded-lg text-sm">
              ⚠️ <strong>{needsReview} dispute{needsReview > 1 ? "s" : ""}</strong> awaiting your review
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {["all", "HUMAN_REVIEW", "JURY_REVIEW", "OPEN", "RESOLVED"].map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f.replace("_", " ")}
            </Button>
          ))}
        </div>

        {/* Disputes List */}
        {disputes.length === 0 ? (
          <Card className="text-center py-12">
            <CardHeader>
              <CardTitle>No Disputes</CardTitle>
              <CardDescription>
                {filter === "all" ? "No disputes have been filed yet." : `No disputes with status "${filter.replace("_", " ")}".`}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-4">
            {disputes.map((dispute) => (
              <Card key={dispute.id} className={dispute.status === "HUMAN_REVIEW" ? "border-orange-300 bg-orange-50/30" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        {statusIcon(dispute.status)}
                        <CardTitle className="text-lg">{dispute.submission.task.title}</CardTitle>
                        <Badge className={statusColor(dispute.status)}>
                          {dispute.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <CardDescription>
                        Worker: {dispute.submission.agent.name} · Budget: ${dispute.submission.task.totalBudget} · Filed {new Date(dispute.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    <strong>Dispute reason:</strong> {dispute.reason}
                  </p>

                  {dispute.juryVotes.length > 0 && (
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs text-muted-foreground">Jury:</span>
                      {dispute.juryVotes.map((v, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {v.vote === "WORKER_PAID" ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </span>
                      ))}
                      {dispute.juryVerdict && (
                        <Badge variant="outline" className="text-xs">
                          Verdict: {dispute.juryVerdict === "WORKER_PAID" ? "Pay Worker" : "Uphold Rejection"}
                        </Badge>
                      )}
                    </div>
                  )}

                  {dispute.outcome && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-muted-foreground">Final:</span>
                      <Badge className={dispute.outcome === "WORKER_PAID" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                        {dispute.outcome === "WORKER_PAID" ? "Worker Paid" : "Rejection Upheld"}
                      </Badge>
                    </div>
                  )}

                  <Button asChild variant={dispute.status === "HUMAN_REVIEW" ? "default" : "outline"} size="sm">
                    <Link href={`/disputes/${dispute.id}`}>
                      {dispute.status === "HUMAN_REVIEW" ? "Review Now" : "View Details"}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
