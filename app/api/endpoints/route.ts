import { NextResponse } from 'next/server'
import {
  listEndpoints,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
} from '@/lib/endpoint-store'
import { normalizeBaseUrl } from '@/lib/normalize'

export async function GET() {
  const endpoints = await listEndpoints()
  return NextResponse.json(endpoints)
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const baseUrl =
    typeof body?.baseUrl === 'string' ? normalizeBaseUrl(body.baseUrl) : ''
  const note = typeof body?.note === 'string' ? body.note.trim() : undefined

  if (!name || !baseUrl) {
    return NextResponse.json({ error: '名称和 base URL 为必填' }, { status: 400 })
  }
  if (!/^https?:\/\//i.test(baseUrl)) {
    return NextResponse.json(
      { error: 'base URL 必须以 http:// 或 https:// 开头' },
      { status: 400 },
    )
  }

  const endpoint = await createEndpoint({ name, baseUrl, note })
  return NextResponse.json(endpoint, { status: 201 })
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!id) {
    return NextResponse.json({ error: '缺少端点 id' }, { status: 400 })
  }

  const data: { name?: string; baseUrl?: string; note?: string } = {}
  if (typeof body.name === 'string' && body.name.trim()) {
    data.name = body.name.trim()
  }
  if (typeof body.baseUrl === 'string' && body.baseUrl.trim()) {
    const normalized = normalizeBaseUrl(body.baseUrl)
    if (!/^https?:\/\//i.test(normalized)) {
      return NextResponse.json(
        { error: 'base URL 必须以 http:// 或 https:// 开头' },
        { status: 400 },
      )
    }
    data.baseUrl = normalized
  }
  if (typeof body.note === 'string') {
    data.note = body.note.trim()
  }

  const updated = await updateEndpoint(id, data)
  if (!updated) {
    return NextResponse.json({ error: '端点不存在' }, { status: 404 })
  }
  return NextResponse.json(updated)
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: '缺少端点 id' }, { status: 400 })
  }
  const ok = await deleteEndpoint(id)
  if (!ok) {
    return NextResponse.json({ error: '端点不存在' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
