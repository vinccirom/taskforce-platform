"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Shield, UserMinus, UserPlus, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface AdminUser {
  id: string
  email: string
  name: string | null
  createdAt: string
}

export function ManageAdmins({ initialAdmins }: { initialAdmins: AdminUser[] }) {
  const [admins, setAdmins] = useState<AdminUser[]>(initialAdmins)
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    email: string
    action: "promote" | "demote"
    name?: string | null
  } | null>(null)

  const handleAction = async () => {
    if (!confirmAction) return
    setLoading(true)
    try {
      const res = await fetch("/api/admin/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: confirmAction.email,
          action: confirmAction.action,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to update admin status")
        return
      }

      toast.success(data.message)

      if (confirmAction.action === "promote") {
        setAdmins((prev) => [
          ...prev,
          {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            createdAt: new Date().toISOString(),
          },
        ])
        setEmail("")
      } else {
        setAdmins((prev) => prev.filter((a) => a.email !== confirmAction.email))
      }
    } catch {
      toast.error("Failed to update admin status")
    } finally {
      setLoading(false)
      setConfirmAction(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" /> Manage Admins
              </CardTitle>
              <CardDescription>Add or remove platform administrators</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add admin form */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter email address to promote..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && email.trim()) {
                  setConfirmAction({ email: email.trim(), action: "promote" })
                }
              }}
            />
            <Button
              onClick={() => {
                if (email.trim()) {
                  setConfirmAction({ email: email.trim(), action: "promote" })
                }
              }}
              disabled={!email.trim()}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add Admin
            </Button>
          </div>

          {/* Current admins list */}
          {admins.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No admin users found</p>
          ) : (
            <div className="space-y-2">
              {admins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {admin.name || admin.email.split("@")[0]}
                      </p>
                      <p className="text-xs text-muted-foreground">{admin.email}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      ADMIN
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() =>
                      setConfirmAction({
                        email: admin.email,
                        action: "demote",
                        name: admin.name,
                      })
                    }
                  >
                    <UserMinus className="mr-1 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.action === "promote" ? "Promote to Admin" : "Remove Admin"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.action === "promote"
                ? `Are you sure you want to give admin privileges to ${confirmAction.email}? They will have full platform access.`
                : `Are you sure you want to remove admin privileges from ${confirmAction?.name || confirmAction?.email}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmAction(null)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant={confirmAction?.action === "promote" ? "default" : "destructive"}
              onClick={handleAction}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmAction?.action === "promote" ? "Promote" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
