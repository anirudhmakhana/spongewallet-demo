'use client'
import { useState, useEffect, use } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

interface Policy {
  expiresAt: number
  maxTransactions: number
  remainingTransactions: number
  maxAmountPerTxUsdc: string
  allowedRecipients: string[]
}

interface WalletData {
  walletId: string
  address: string
  policy?: Policy
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="border-gray-700 text-gray-300 hover:text-white shrink-0"
    >
      {copied ? 'Copied!' : (label || 'Copy')}
    </Button>
  )
}

export default function SetupPage({ params }: { params: Promise<{ walletId: string }> }) {
  const { walletId } = use(params)
  const [apiKey] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return null
    }

    return window.sessionStorage.getItem(`apiKey_${walletId}`)
  })
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${BACKEND_URL}/v1/wallets/${walletId}`)
      .then((r) => r.json())
      .then((data) => setWalletData(data))
      .catch(() => toast.error('Failed to load wallet data'))
      .finally(() => setLoading(false))
  }, [walletId])

  const claudeCommand = `claude mcp add --transport http spongewallet ${BACKEND_URL}/mcp --header "Authorization: Bearer ${apiKey || 'YOUR_API_KEY'}"`
  const skillUrl = `${BACKEND_URL}/skills/openclaw.md?walletId=${walletId}`
  const openclawCommand = `/install ${skillUrl}`

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        Loading...
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">SpongeWallet Setup</h1>
          <p className="text-gray-400 mt-2">Your sponsored smart-account USDC wallet is ready</p>
        </div>

        {/* Yellow warning banner */}
        <div className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-200 rounded-lg p-4">
          ⚠️ <strong>Your API key is shown only once.</strong> Copy and save it now — it cannot be recovered after you leave this page.
        </div>

        {/* Card 1: API Key */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">API Key</CardTitle>
            <Badge variant="destructive">Save Now</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {apiKey ? (
              <>
                <div className="flex items-start gap-2">
                  <code className="flex-1 font-mono text-sm bg-gray-950 text-green-400 p-3 rounded break-all">
                    {apiKey}
                  </code>
                  <CopyButton text={apiKey} />
                </div>
                <p className="text-gray-500 text-sm">
                  Save this key now. You can restore this wallet later from the home page by pasting the saved API key.
                </p>
              </>
            ) : (
              <p className="text-yellow-400 text-sm">
                API key not found in this browser session. Go back to the home page and use Restore Existing Wallet with your saved API key.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Claude Code (hero) */}
        <Card className="bg-gray-900 border-gray-800 ring-1 ring-purple-500/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white text-xl">Connect Claude Code</CardTitle>
              <p className="text-gray-400 text-sm mt-1">Run this once in your terminal</p>
            </div>
            <Badge className="bg-purple-600 text-white shrink-0">Run this once</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <code className="flex-1 font-mono text-sm bg-gray-950 text-purple-400 p-4 rounded break-all whitespace-pre-wrap">
                {claudeCommand}
              </code>
            </div>
            <CopyButton text={claudeCommand} label="Copy Command" />
          </CardContent>
        </Card>

        {/* Card 3: skill.md */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">skill.md File</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href={skillUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm underline break-all"
            >
              {skillUrl}
            </a>
            <p className="text-gray-400 text-sm">Install via OpenClaw:</p>
            <div className="flex items-start gap-2">
              <code className="flex-1 font-mono text-sm bg-gray-950 text-orange-400 p-3 rounded break-all whitespace-pre-wrap">
                {openclawCommand}
              </code>
              <CopyButton text={openclawCommand} />
            </div>
            <p className="text-gray-500 text-sm">Set <code className="font-mono">SPONGEWALLET_API_KEY</code> in OpenClaw before using the skill.</p>
          </CardContent>
        </Card>

        {/* Card 4: Fund Wallet */}
        {walletData && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Fund Your Wallet</CardTitle>
              <Badge variant="destructive">Base Sepolia only</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-sm bg-gray-950 text-gray-300 p-3 rounded break-all">
                  {walletData.address}
                </code>
                <CopyButton text={walletData.address} />
              </div>
              <a
                href={`https://sepolia.basescan.org/address/${walletData.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm underline"
              >
                View on Basescan →
              </a>
              <div className="text-sm text-gray-400 space-y-1">
                <p>Deposit Base Sepolia USDC to this smart account address.</p>
                <p>The wallet does not need ETH. Pimlico sponsors user operations for transfers.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card 5: Spending Policy */}
        {walletData?.policy && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Spending Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-gray-400">Expiry</span>
                  <p className="text-white">{new Date(walletData.policy.expiresAt).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-400">Remaining Transactions</span>
                  <p className="text-white">{walletData.policy.remainingTransactions}</p>
                </div>
                <div>
                  <span className="text-gray-400">Max per Tx USDC</span>
                  <p className="text-white">{walletData.policy.maxAmountPerTxUsdc} USDC</p>
                </div>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Allowed Recipients</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {walletData.policy.allowedRecipients.map((addr) => (
                    <Badge key={addr} variant="secondary" className="font-mono text-xs">
                      {addr}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
