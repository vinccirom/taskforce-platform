"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, AlertTriangle, Loader2, ArrowUpRight } from "lucide-react";

interface WithdrawFormProps {
  walletAddress: string;
}

export function WithdrawForm({ walletAddress }: WithdrawFormProps) {
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [chain, setChain] = useState<"solana" | "base">("solana");
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchBalance();
  }, []);

  async function fetchBalance() {
    setBalanceLoading(true);
    try {
      const res = await fetch("/api/user/wallet/balance");
      if (res.ok) {
        const data = await res.json();
        setUsdcBalance(data.usdcBalance ?? 0);
      } else {
        setUsdcBalance(0);
      }
    } catch {
      setUsdcBalance(0);
    } finally {
      setBalanceLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/user/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          amount: parseFloat(amount),
          chain,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult({
          success: true,
          message: `Withdrawal successful! TX: ${data.transactionHash}`,
        });
        setDestination("");
        setAmount("");
        fetchBalance();
      } else {
        setResult({ success: false, message: data.error || "Withdrawal failed" });
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message || "Network error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowUpRight className="h-5 w-5" />
          Withdraw USDC
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Wallet Address */}
        <div>
          <Label className="text-sm text-muted-foreground">Your Wallet Address</Label>
          <div className="flex items-center gap-2 mt-1">
            <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono truncate">
              {walletAddress}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Balance */}
        <div>
          <Label className="text-sm text-muted-foreground">USDC Balance</Label>
          <p className="text-2xl font-bold mt-1">
            {balanceLoading ? (
              <Loader2 className="h-5 w-5 animate-spin inline" />
            ) : (
              `$${(usdcBalance ?? 0).toFixed(2)}`
            )}
          </p>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-amber-800">
            You need native SOL (or ETH for Base) in your wallet for transaction fees. Gas is not sponsored for withdrawals.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Chain selector */}
          <div>
            <Label>Chain</Label>
            <div className="flex gap-2 mt-1">
              {(["solana", "base"] as const).map((c) => (
                <Button
                  key={c}
                  type="button"
                  variant={chain === c ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChain(c)}
                >
                  {c === "solana" ? "Solana" : "Base"}
                </Button>
              ))}
            </div>
          </div>

          {/* Destination */}
          <div>
            <Label htmlFor="destination">Destination Wallet</Label>
            <Input
              id="destination"
              placeholder={chain === "solana" ? "Solana address..." : "0x..."}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          {/* Amount */}
          <div>
            <Label htmlFor="amount">Amount (USDC)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => usdcBalance && setAmount(usdcBalance.toString())}
                disabled={!usdcBalance}
              >
                Max
              </Button>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div
              className={`p-3 rounded-lg text-sm ${
                result.success
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}
            >
              {result.message}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              "Withdraw USDC"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
