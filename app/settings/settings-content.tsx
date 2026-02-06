"use client"

import { useState, useEffect } from "react"
import { usePrivy } from "@privy-io/react-auth"
import { useWallets, useCreateWallet as useCreateSolanaWallet } from "@privy-io/react-auth/solana"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layouts/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { useCreateWallet as useCreateEthWallet } from "@privy-io/react-auth"
import {
  User,
  Wallet,
  Mail,
  Shield,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  Pencil,
  Plus,
} from "lucide-react"

interface UserProfile {
  id: string
  name: string | null
  email: string
  role: string
  walletAddress: string | null
  wallets: { address: string; chain: string }[]
  createdAt: string
}

export function SettingsContent() {
  const { ready, authenticated, user, logout } = usePrivy()
  const { wallets: solanaWallets } = useWallets()
  const { createWallet: createSolanaWallet } = useCreateSolanaWallet()
  const { createWallet: createEthWallet } = useCreateEthWallet()
  const router = useRouter()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState("")
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [creatingWallet, setCreatingWallet] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    if (!authenticated) {
      router.push("/")
      return
    }
    fetchProfile()
  }, [ready, authenticated])

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/user/profile")
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
        setNameInput(data.name || "")
      }
    } catch (e) {
      console.error("Failed to fetch profile:", e)
    } finally {
      setLoading(false)
    }
  }

  const saveName = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput.trim() || null }),
      })
      if (res.ok) {
        const updated = await res.json()
        setProfile(prev => prev ? { ...prev, ...updated } : prev)
        setEditingName(false)
        toast.success("Name updated")
      } else {
        toast.error("Failed to update name")
      }
    } catch (e) {
      toast.error("Failed to update name")
    } finally {
      setSaving(false)
    }
  }

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    setCopiedAddress(address)
    toast.success("Address copied!")
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  const handleCreateWallet = async (chain: "solana" | "ethereum") => {
    setCreatingWallet(chain)
    try {
      if (chain === "solana") {
        await createSolanaWallet()
      } else {
        await createEthWallet()
      }
      toast.success(`${chain === "solana" ? "Solana" : "Ethereum"} wallet created!`)
      // Refresh profile to get new wallet
      fetchProfile()
    } catch (e: any) {
      if (e?.message?.includes("already has")) {
        toast.info("Wallet already exists — try refreshing the page")
      } else {
        toast.error(`Failed to create wallet: ${e?.message || "Unknown error"}`)
      }
    } finally {
      setCreatingWallet(null)
    }
  }

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "CREATOR":
        return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">Creator</Badge>
      case "AGENT_OPERATOR":
        return <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-100">Agent Operator</Badge>
      case "ADMIN":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Admin</Badge>
      default:
        return <Badge variant="secondary">{role}</Badge>
    }
  }

  const getExplorerUrl = (address: string, chain: string) => {
    if (chain === "solana") return `https://explorer.solana.com/address/${address}?cluster=devnet`
    return `https://etherscan.io/address/${address}`
  }

  if (!ready || loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    )
  }

  if (!profile) {
    return (
      <AppShell>
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <p className="text-muted-foreground">Could not load profile.</p>
        </div>
      </AppShell>
    )
  }

  // Merge wallets from API + client-side Privy SDK (in case API hasn't caught up)
  const allWallets = [...(profile.wallets || [])]
  for (const sw of solanaWallets) {
    if (!allWallets.find(w => w.address === sw.address)) {
      allWallets.push({ address: sw.address, chain: "solana" })
    }
  }

  const displayEmail = profile.email?.includes("@privy.io") ? null : profile.email

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground mb-8">Manage your account and wallets</p>

        <div className="space-y-6">
          {/* Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
              <CardDescription>Your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name */}
              <div>
                <Label className="text-sm text-muted-foreground">Display Name</Label>
                {editingName ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      placeholder="Enter your name"
                      className="max-w-xs"
                    />
                    <Button size="sm" onClick={saveName} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingName(false); setNameInput(profile.name || "") }}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <p className="font-medium">{profile.name || <span className="text-muted-foreground italic">Not set</span>}</p>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingName(true)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* Email */}
              <div>
                <Label className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </Label>
                <p className="font-medium mt-1">
                  {displayEmail || <span className="text-muted-foreground italic">No email linked</span>}
                </p>
              </div>

              <Separator />

              {/* Role */}
              <div>
                <Label className="text-sm text-muted-foreground flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5" />
                  Role
                </Label>
                <div className="mt-1">
                  {profile.role ? getRoleBadge(profile.role) : <span className="text-muted-foreground italic">No role set</span>}
                </div>
              </div>

              <Separator />

              {/* Member since */}
              <div>
                <Label className="text-sm text-muted-foreground">Member Since</Label>
                <p className="font-medium mt-1">
                  {new Date(profile.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Wallets Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Wallets
              </CardTitle>
              <CardDescription>
                Your connected wallets. Fund your Solana wallet with USDC to create and activate tasks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allWallets.length === 0 ? (
                <p className="text-muted-foreground text-sm">No wallets connected yet. They'll appear after your first login.</p>
              ) : (
                <div className="space-y-3">
                  {allWallets.map((wallet, idx) => (
                    <div
                      key={`${wallet.chain}-${wallet.address}`}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={wallet.chain === 'solana' ? '/solana.png' : '/base.png'}
                          alt={wallet.chain === 'solana' ? 'Solana' : 'Base / EVM'}
                          className="h-8 w-8 rounded-full flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{wallet.chain === 'solana' ? 'Solana' : 'Base / EVM'} Wallet</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {truncateAddress(wallet.address)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => copyAddress(wallet.address)}
                        >
                          {copiedAddress === wallet.address ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          asChild
                        >
                          <a
                            href={getExplorerUrl(wallet.address, wallet.chain)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Create wallet buttons if missing */}
              {(() => {
                const hasSolana = allWallets.some(w => w.chain === "solana")
                const hasEthereum = allWallets.some(w => w.chain === "ethereum")
                if (hasSolana && hasEthereum) return null
                return (
                  <div className="flex gap-2 mt-3">
                    {!hasSolana && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCreateWallet("solana")}
                        disabled={creatingWallet !== null}
                      >
                        {creatingWallet === "solana" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="mr-2 h-4 w-4" />
                        )}
                        Create Solana Wallet
                      </Button>
                    )}
                    {!hasEthereum && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCreateWallet("ethereum")}
                        disabled={creatingWallet !== null}
                      >
                        {creatingWallet === "ethereum" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="mr-2 h-4 w-4" />
                        )}
                        Create Base / EVM Wallet
                      </Button>
                    )}
                  </div>
                )
              })()}

              <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                <p className="font-medium">💡 How to fund your wallet</p>
                <p className="mt-1 text-amber-700">
                  Send USDC to your Solana wallet address above from any exchange or wallet. 
                  You'll need USDC to activate tasks and a small amount of SOL for transaction fees.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="text-destructive text-base">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Sign Out</p>
                  <p className="text-xs text-muted-foreground">Sign out of your account on this device</p>
                </div>
                <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { logout(); router.push("/") }}>
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
