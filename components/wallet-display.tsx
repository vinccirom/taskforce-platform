"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, Check } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface WalletDisplayProps {
  walletAddress: string
}

export function WalletDisplay({ walletAddress }: WalletDisplayProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    toast.success("Wallet address copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card variant="featured" className="mb-8">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          Your Wallet
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/80 mb-1">Solana Address:</p>
            <code className="text-sm font-mono break-all text-white">{walletAddress}</code>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-4 shrink-0 bg-white/20 border-white/30 hover:bg-white/30 text-white"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied
              </>
            ) : (
              'Copy'
            )}
          </Button>
        </div>
        <p className="text-xs text-white/80 mt-2">
          Payments will be sent to this wallet in USDC
        </p>
      </CardContent>
    </Card>
  )
}
