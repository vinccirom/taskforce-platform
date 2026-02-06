"use client"

import { useState, useEffect } from "react"
import { useWallets } from "@privy-io/react-auth/solana"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QRCodeSVG } from "qrcode.react"
import { Check, Copy, Loader2, Wallet, QrCode, Send, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
} from "@solana/web3.js"
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token"

interface TaskPaymentProps {
  taskId: string
  totalBudget: number
  escrowWalletAddress?: string | null
  onSuccess?: () => void
}

const PLATFORM_WALLET = process.env.NEXT_PUBLIC_PLATFORM_WALLET_ADDRESS || ""
const USDC_MINT = process.env.NEXT_PUBLIC_USDC_MINT || ""
const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com"
const MOCK_TRANSFERS = process.env.NEXT_PUBLIC_MOCK_TRANSFERS === "true"

type PaymentChain = "SOLANA" | "EVM"

export function TaskPayment({ taskId, totalBudget, escrowWalletAddress, onSuccess }: TaskPaymentProps) {
  const targetWallet = escrowWalletAddress || PLATFORM_WALLET
  const { wallets } = useWallets()
  const [loading, setLoading] = useState(false)
  const [selectedChain, setSelectedChain] = useState<PaymentChain>("SOLANA")
  const [activeTab, setActiveTab] = useState<"privy" | "manual" | "solana-pay">("privy")
  const [copied, setCopied] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [paymentReference, setPaymentReference] = useState<string>("")
  const [polling, setPolling] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const solanaWallet = wallets[0] ?? null

  useEffect(() => {
    const reference = Keypair.generate().publicKey.toBase58()
    setPaymentReference(reference)
  }, [])

  useEffect(() => {
    async function fetchBalance() {
      if (!solanaWallet?.address || selectedChain !== "SOLANA") return

      try {
        const connection = new Connection(SOLANA_RPC_URL, "confirmed")
        const mintPubkey = new PublicKey(USDC_MINT)
        const walletPubkey = new PublicKey(solanaWallet.address)
        const tokenAccount = await getAssociatedTokenAddress(mintPubkey, walletPubkey)
        const accountInfo = await connection.getTokenAccountBalance(tokenAccount)
        setBalance(parseFloat(accountInfo.value.uiAmount?.toString() || "0"))
      } catch (error) {
        console.error("Error fetching balance:", error)
        setBalance(0)
      }
    }

    fetchBalance()
  }, [solanaWallet?.address, selectedChain])

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success("Copied to clipboard!")
    setTimeout(() => setCopied(false), 2000)
  }

  // Privy Wallet Payment (Solana only for now)
  const handlePrivyPayment = async () => {
    if (selectedChain === "EVM") {
      toast.error("EVM wallet payment coming soon. Use Manual Transfer for Base.")
      return
    }

    if (!solanaWallet) {
      toast.error("No Solana wallet found. Please refresh and try again.")
      return
    }

    setLoading(true)
    try {
      if (MOCK_TRANSFERS) {
        console.log("🎭 MOCK: Simulating Privy wallet payment")
        await new Promise(resolve => setTimeout(resolve, 2000))

        const mockTxHash = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`

        const response = await fetch(`/api/tasks/${taskId}/activate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method: "privy",
            transactionHash: mockTxHash,
            paymentChain: selectedChain,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to activate task")
        }

        toast.success("✅ Task activated successfully! (MOCK MODE)")
        onSuccess?.()
        return
      }

      const connection = new Connection(SOLANA_RPC_URL, "confirmed")
      const fromPubkey = new PublicKey(solanaWallet.address)
      const toPubkey = new PublicKey(targetWallet)
      const mintPubkey = new PublicKey(USDC_MINT)

      const fromTokenAccount = await getAssociatedTokenAddress(mintPubkey, fromPubkey)
      const toTokenAccount = await getAssociatedTokenAddress(mintPubkey, toPubkey)
      const toAccountInfo = await connection.getAccountInfo(toTokenAccount)

      const transaction = new Transaction()

      if (!toAccountInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(fromPubkey, toTokenAccount, toPubkey, mintPubkey)
        )
      }

      const amountLamports = Math.floor(totalBudget * 1_000_000)
      transaction.add(createTransferInstruction(fromTokenAccount, toTokenAccount, fromPubkey, amountLamports))

      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = fromPubkey

      let signature: string

      if (typeof (solanaWallet as any).sendTransaction === "function") {
        signature = await (solanaWallet as any).sendTransaction(transaction, connection)
      } else if ((solanaWallet as any).provider?.sendTransaction) {
        signature = await (solanaWallet as any).provider.sendTransaction(transaction, connection)
      } else {
        throw new Error("Wallet does not support sendTransaction.")
      }

      await connection.confirmTransaction(signature, "confirmed")

      const response = await fetch(`/api/tasks/${taskId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "privy",
          transactionHash: signature,
          paymentChain: selectedChain,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to activate task")
      }

      toast.success("✅ Task activated successfully!")
      onSuccess?.()
    } catch (error: any) {
      console.error("Payment error:", error)
      toast.error(error.message || "Payment failed.")
    } finally {
      setLoading(false)
    }
  }

  const handleManualVerification = async () => {
    setVerifying(true)
    try {
      const response = await fetch(`/api/tasks/${taskId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "manual",
          paymentChain: selectedChain,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Payment not found")
      }

      toast.success("✅ Payment verified! Task activated.")
      onSuccess?.()
    } catch (error: any) {
      console.error("Verification error:", error)
      toast.error(error.message || "Payment verification failed")
    } finally {
      setVerifying(false)
    }
  }

  const startSolanaPayPolling = async () => {
    if (polling) return
    setPolling(true)
    toast.info("Waiting for payment...")

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}/activate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method: "solana-pay",
            reference: paymentReference,
            paymentChain: selectedChain,
          }),
        })

        if (response.ok) {
          clearInterval(pollInterval)
          setPolling(false)
          toast.success("✅ Payment received! Task activated.")
          onSuccess?.()
        }
      } catch (error) {
        console.error("Polling error:", error)
      }
    }, 5000)

    setTimeout(() => {
      clearInterval(pollInterval)
      setPolling(false)
      toast.info("Stopped waiting for payment")
    }, 600000)
  }

  const solanaPayUrl = `solana:${targetWallet}?amount=${totalBudget}&spl-token=${USDC_MINT}&reference=${paymentReference}&label=TaskForce%20Task%20Activation&message=Activate%20Task%20${taskId}`

  const hasInsufficientBalance = balance !== null && balance < totalBudget

  return (
    <div className="space-y-4">
      {/* Chain Selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Payment Chain</label>
        <div className="grid grid-cols-2 gap-3">
          {([
            { chain: "SOLANA" as const, label: "Solana", icon: "/solana.png" },
            { chain: "EVM" as const, label: "Base", icon: "/base.png" },
          ]).map(({ chain, label, icon }) => (
            <button
              key={chain}
              onClick={() => setSelectedChain(chain)}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                selectedChain === chain
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-muted/50"
              }`}
            >
              <img src={icon} alt={label} className="h-7 w-7 rounded-full" />
              <div className="text-left">
                <div className="font-medium text-sm">{label}</div>
                <div className="text-xs text-muted-foreground">USDC</div>
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Workers will be paid out on the same chain you fund the escrow with.
        </p>
      </div>

      {/* Payment Methods */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className={`grid w-full ${selectedChain === "SOLANA" ? "grid-cols-3" : "grid-cols-1"}`}>
          {selectedChain === "SOLANA" && (
            <TabsTrigger value="privy">
              <Wallet className="h-4 w-4 mr-2" />
              Privy Wallet
            </TabsTrigger>
          )}
          <TabsTrigger value="manual">
            <Send className="h-4 w-4 mr-2" />
            Manual Transfer
          </TabsTrigger>
          {selectedChain === "SOLANA" && (
            <TabsTrigger value="solana-pay">
              <QrCode className="h-4 w-4 mr-2" />
              Solana Pay
            </TabsTrigger>
          )}
        </TabsList>

        {/* Privy Wallet (Solana only) */}
        {selectedChain === "SOLANA" && (
          <TabsContent value="privy" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <img src="/solana.png" alt="Solana" className="h-5 w-5 rounded-full" />
                  <CardTitle className="text-base">One-Click Payment</CardTitle>
                </div>
                <CardDescription>
                  Pay directly from your embedded Solana wallet
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {solanaWallet ? (
                  <>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Your Wallet</div>
                      <div className="font-mono text-xs bg-muted p-2 rounded break-all">
                        {solanaWallet.address}
                      </div>
                    </div>

                    {balance !== null && (
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">Balance</div>
                        <div className="text-lg font-semibold">{balance.toFixed(2)} USDC</div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">Amount</div>
                      <div className="text-2xl font-bold text-primary">${totalBudget.toFixed(2)} USDC</div>
                    </div>

                    {hasInsufficientBalance && !MOCK_TRANSFERS && (
                      <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">Insufficient balance</div>
                          <div className="text-xs mt-1">
                            Fund your wallet or use Manual Transfer instead.
                          </div>
                        </div>
                      </div>
                    )}

                    {MOCK_TRANSFERS && (
                      <div className="p-3 bg-blue-50 text-blue-700 text-sm rounded-lg">
                        🎭 MOCK MODE: Payment will be simulated
                      </div>
                    )}

                    <Button
                      onClick={handlePrivyPayment}
                      disabled={loading || (hasInsufficientBalance && !MOCK_TRANSFERS)}
                      className="w-full"
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Wallet className="mr-2 h-4 w-4" />
                          Pay ${totalBudget.toFixed(2)} USDC
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-6 text-muted-foreground space-y-2">
                    <div>No Solana wallet found.</div>
                    <div className="text-xs">Try refreshing the page or use Manual Transfer.</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Manual Transfer */}
        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <img
                  src={selectedChain === "SOLANA" ? "/solana.png" : "/base.png"}
                  alt={selectedChain === "SOLANA" ? "Solana" : "Base"}
                  className="h-5 w-5 rounded-full"
                />
                <CardTitle className="text-base">Manual Transfer</CardTitle>
              </div>
              <CardDescription>
                Send USDC on {selectedChain === "SOLANA" ? "Solana" : "Base"} to the escrow address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">1. Send USDC to this address:</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-xs bg-muted p-3 rounded break-all">
                    {targetWallet}
                  </div>
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(targetWallet)}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                {escrowWalletAddress && (
                  <p className="text-xs text-muted-foreground">
                    💡 Dedicated escrow wallet for this task
                  </p>
                )}
                {selectedChain === "EVM" && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg">
                    ⚠️ Make sure you send USDC on the <strong>Base</strong> network, not Ethereum mainnet.
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">2. Amount to send:</div>
                <div className="text-2xl font-bold text-primary">${totalBudget.toFixed(2)} USDC</div>
              </div>

              <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                ⏱️ After sending, click &quot;I&apos;ve Sent the Payment&quot; below.
              </div>

              {MOCK_TRANSFERS && (
                <div className="p-3 bg-blue-50 text-blue-700 text-sm rounded-lg">
                  🎭 MOCK MODE: Verification will be simulated
                </div>
              )}

              <Button onClick={handleManualVerification} disabled={verifying} className="w-full" size="lg">
                {verifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "I've Sent the Payment"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Solana Pay (Solana only) */}
        {selectedChain === "SOLANA" && (
          <TabsContent value="solana-pay" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <img src="/solana.png" alt="Solana" className="h-5 w-5 rounded-full" />
                  <CardTitle className="text-base">Solana Pay QR Code</CardTitle>
                </div>
                <CardDescription>
                  Scan with a Solana wallet app (Phantom, Solflare, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center py-4">
                  <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                    <QRCodeSVG value={solanaPayUrl} size={200} level="M" includeMargin={true} />
                  </div>
                </div>

                <div className="text-center space-y-2">
                  <div className="text-sm text-muted-foreground">Amount</div>
                  <div className="text-2xl font-bold text-primary">${totalBudget.toFixed(2)} USDC</div>
                </div>

                <div className="text-center">
                  <a href={solanaPayUrl} className="text-primary hover:underline text-sm" onClick={() => startSolanaPayPolling()}>
                    Open in wallet app →
                  </a>
                </div>

                {MOCK_TRANSFERS && (
                  <div className="p-3 bg-blue-50 text-blue-700 text-sm rounded-lg">
                    🎭 MOCK MODE: Scanning QR will be simulated
                  </div>
                )}

                {polling ? (
                  <div className="flex items-center justify-center gap-2 p-4 bg-blue-50 text-blue-700 rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Waiting for payment...</span>
                  </div>
                ) : (
                  <Button onClick={startSolanaPayPolling} variant="outline" className="w-full">
                    Start Monitoring for Payment
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
