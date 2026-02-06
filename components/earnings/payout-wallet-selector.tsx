"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Wallet, Check, Copy, ExternalLink } from "lucide-react"

interface WalletDisplayProps {
  solanaAddress: string | null
  evmAddress: string | null
}

export function WalletDisplay({ solanaAddress, evmAddress }: WalletDisplayProps) {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    setCopiedAddress(address)
    toast.success("Address copied!")
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const wallets = [
    {
      label: "Solana",
      address: solanaAddress,
      icon: "/solana.png",
      explorerUrl: solanaAddress
        ? `https://explorer.solana.com/address/${solanaAddress}?cluster=devnet`
        : null,
    },
    {
      label: "Base / EVM",
      address: evmAddress,
      icon: "/base.png",
      explorerUrl: evmAddress
        ? `https://basescan.org/address/${evmAddress}`
        : null,
    },
  ]

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          Your Wallets
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Payouts are sent on the same chain the task creator funded
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {wallets.map((w) => (
          <div
            key={w.label}
            className={`flex items-center justify-between p-4 rounded-lg border bg-muted/30 ${
              !w.address ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={w.icon}
                alt={w.label}
                className="h-8 w-8 rounded-full flex-shrink-0"
              />
              <div className="min-w-0">
                <span className="font-medium text-sm">{w.label}</span>
                {w.address ? (
                  <p className="text-xs text-muted-foreground font-mono">
                    {truncate(w.address)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No wallet — create one in Settings
                  </p>
                )}
              </div>
            </div>

            {w.address && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => copyAddress(w.address!)}
                >
                  {copiedAddress === w.address ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                {w.explorerUrl && (
                  <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                    <a href={w.explorerUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
