import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Roboto, Roboto_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const _roboto = Roboto({ subsets: ['latin'], weight: ['400', '500', '700'] })
const _robotoMono = Roboto_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'API 端点检测台',
  description: '个人用 AI API 端点检测与调试工具：可用性探测、模型列表、流式对话测试',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#ffffff',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className="light bg-background">
      <body className="font-sans antialiased">
        {children}
        <Toaster position="top-center" richColors />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
