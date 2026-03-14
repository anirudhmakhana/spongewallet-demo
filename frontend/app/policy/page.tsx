'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PolicyPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/create')
  }, [router])
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
      Redirecting...
    </div>
  )
}
