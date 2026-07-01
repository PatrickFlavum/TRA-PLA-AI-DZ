import type { AppProps } from 'next/app'
import '@/styles/globals.css'
import { useState, useEffect } from 'react'

export default function App({ Component, pageProps }: AppProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  return <Component {...pageProps} />
}
