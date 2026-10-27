import type { Metadata, Viewport } from 'next'
import { Noto_Sans_JP, Geist_Mono } from 'next/font/google'
import { Providers } from '@/components/layout/providers'
import { AppShell } from '@/components/layout/app-shell'
import './globals.css'

const notoSansJp = Noto_Sans_JP({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-noto-sans-jp', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'Cosmo Base Quiz Manager',
  description: '宇宙クイズの出題計画・AI問題生成・事実確認・承認・投稿・回答結果・AI定性分析を一元管理する社内運用ツール',
  generator: 'v0.app',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f7fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1420' },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={`${notoSansJp.variable} ${geistMono.variable} bg-background`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
