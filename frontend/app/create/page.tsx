'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

const EXPIRES_OPTIONS = [
  { label: '1 hour', ms: 1 * 3600 * 1000 },
  { label: '6 hours', ms: 6 * 3600 * 1000 },
  { label: '24 hours', ms: 24 * 3600 * 1000 },
  { label: '7 days', ms: 7 * 24 * 3600 * 1000 },
  { label: '30 days', ms: 30 * 24 * 3600 * 1000 },
]

export default function CreatePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [expiresInMs, setExpiresInMs] = useState(24 * 3600 * 1000)
  const [maxTransactions, setMaxTransactions] = useState('10')
  const [maxAmountPerTxUsdc, setMaxAmountPerTxUsdc] = useState('5.00')
  const [allowedRecipients, setAllowedRecipients] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    const recipients = allowedRecipients
      .split('\n')
      .map((a) => a.trim())
      .filter(Boolean)

    if (recipients.length === 0) {
      toast.error('At least one allowed recipient is required')
      return
    }

    const addressRegex = /^0x[0-9a-fA-F]{40}$/
    for (const addr of recipients) {
      if (!addressRegex.test(addr)) {
        toast.error(`Invalid Ethereum address: ${addr}`)
        return
      }
    }

    const maxTx = parseInt(maxTransactions, 10)
    if (!Number.isInteger(maxTx) || maxTx < 1) {
      toast.error('Max transactions must be a positive integer')
      return
    }

    const amountVal = parseFloat(maxAmountPerTxUsdc)
    if (isNaN(amountVal) || maxAmountPerTxUsdc.trim() === '' || !/^\d+(\.\d{1,6})?$/.test(maxAmountPerTxUsdc)) {
      toast.error('Max amount per transaction must be a valid USDC decimal with up to 6 decimals')
      return
    }

    const expiresAt = Date.now() + expiresInMs

    setLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/v1/wallets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || undefined,
          expiresAt,
          maxTransactions: maxTx,
          maxAmountPerTxUsdc,
          allowedRecipients: recipients,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create wallet')
      }
      const { walletId, address, apiKey } = await res.json()
      sessionStorage.setItem(`apiKey_${walletId}`, apiKey)
      sessionStorage.setItem(`address_${walletId}`, address)
      router.push(`/setup/${walletId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create wallet')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-lg bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Create Agent Wallet</CardTitle>
          <CardDescription className="text-gray-400">
            Generate a sponsored smart-account USDC wallet on Base Sepolia with server-enforced limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-300">Wallet Name (optional)</Label>
            <Input
              id="name"
              placeholder="My Agent Wallet"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expires" className="text-gray-300">Expires In</Label>
            <select
              id="expires"
              value={expiresInMs}
              onChange={(e) => setExpiresInMs(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-600"
            >
              {EXPIRES_OPTIONS.map((opt) => (
                <option key={opt.ms} value={opt.ms}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxTx" className="text-gray-300">Max Transactions</Label>
            <Input
              id="maxTx"
              type="number"
              min="1"
              value={maxTransactions}
              onChange={(e) => setMaxTransactions(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxAmount" className="text-gray-300">Max Amount per Transaction (USDC)</Label>
            <Input
              id="maxAmount"
              type="text"
              placeholder="5.00"
              value={maxAmountPerTxUsdc}
              onChange={(e) => setMaxAmountPerTxUsdc(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipients" className="text-gray-300">Allowed Recipients (one address per line)</Label>
            <Textarea
              id="recipients"
              placeholder={'0x1234...\n0xabcd...'}
              value={allowedRecipients}
              onChange={(e) => setAllowedRecipients(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white font-mono text-sm min-h-[120px]"
            />
          </div>

          <Button onClick={handleCreate} disabled={loading} className="w-full">
            {loading ? 'Creating...' : 'Create Wallet'}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
