'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

export default function Home() {
  const router = useRouter()
  const [apiKey, setApiKey] = useState('')
  const [restoring, setRestoring] = useState(false)

  async function handleRestore() {
    if (!apiKey.includes('.')) {
      toast.error('Enter a valid SpongeWallet API key')
      return
    }

    setRestoring(true)
    try {
      const res = await fetch(`${BACKEND_URL}/v1/me`, {
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
      })

      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to restore wallet')
      }

      window.sessionStorage.setItem(`apiKey_${payload.walletId}`, apiKey.trim())
      window.sessionStorage.setItem(`address_${payload.walletId}`, payload.address)
      router.push(`/setup/${payload.walletId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to restore wallet')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
      <div className="max-w-3xl w-full grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h1 className="text-5xl font-bold mb-4">SpongeWallet</h1>
          <p className="text-xl text-gray-400 mb-8">
            Give your AI agent a sponsored smart-account USDC wallet on Base Sepolia, with enforced spending limits.
          </p>

          <ul className="space-y-3 mb-10 text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-gray-500 mt-1">•</span>
              <span>Spending limits enforced server-side — tx count, max USDC, recipient allowlist, expiry</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-500 mt-1">•</span>
              <span>Sponsored smart-account sends — Turnkey controls the owner while Pimlico sponsors gas</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-500 mt-1">•</span>
              <span>Base Sepolia only — no mainnet risk</span>
            </li>
          </ul>

          <Link href="/create">
            <Button size="lg" className="text-lg px-8 py-4">
              Create Agent Wallet →
            </Button>
          </Link>
        </div>

        <Card className="bg-gray-900 border-gray-800 md:mt-6">
          <CardHeader>
            <CardTitle className="text-white">Restore Existing Wallet</CardTitle>
            <CardDescription className="text-gray-400">
              Paste a saved API key to reopen your existing agent wallet and setup instructions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="wallet-id.secret"
              className="bg-gray-800 border-gray-700 text-white font-mono"
            />
            <Button onClick={handleRestore} disabled={restoring} className="w-full">
              {restoring ? 'Restoring...' : 'Restore Wallet'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
