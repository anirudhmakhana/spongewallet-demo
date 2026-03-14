'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
      <div className="max-w-xl w-full">
        <h1 className="text-5xl font-bold mb-4">SpongeWallet</h1>
        <p className="text-xl text-gray-400 mb-8">
          Give your AI agent a managed ETH wallet on Base Sepolia — with enforced spending limits.
        </p>

        <ul className="space-y-3 mb-10 text-gray-300">
          <li className="flex items-start gap-2">
            <span className="text-gray-500 mt-1">•</span>
            <span>Spending limits enforced server-side — tx count, max ETH, recipient allowlist, expiry</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-500 mt-1">•</span>
            <span>MCP-native — connect Claude Code with one command</span>
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
    </main>
  )
}
