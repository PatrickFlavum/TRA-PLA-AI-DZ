import type { GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'

export const getStaticProps: GetStaticProps = async () => ({ props: {} })

export default function Home() {
  return (
    <>
      <Head><title>AI@DZ Transformation Plans</title></Head>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI@DZ Transformation Plans</h1>
          <p className="text-gray-500 mb-8">
            Planen Sie die AI-Transformation Ihrer Arbeitsorganisation
          </p>
          <Link
            href="/admin"
            className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors"
          >
            Zum Adminbereich
          </Link>
        </div>
        <footer className="absolute bottom-4 text-xs text-gray-400">
          © {new Date().getFullYear()} AI@DZ OE-Team
        </footer>
      </div>
    </>
  )
}
