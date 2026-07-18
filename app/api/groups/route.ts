import { NextResponse } from 'next/server'
import {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
} from '@/lib/endpoint-store'

export async function GET() {
  const groups = await listGroups()
  return NextResponse.json(groups)
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const note = typeof body?.note === 'string' ? body.note.trim() : undefined

  if (!name) {
    return NextResponse.json({ error: '分组名称为必填' }, { status: 400 })
  }

  const group = await createGroup({ name, note })
  return NextResponse.json(group, { status: 201 })
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!id) {
    return NextResponse.json({ error: '缺少分组 id' }, { status: 400 })
  }

  const data: { name?: string; note?: string } = {}
  if (typeof body.name === 'string' && body.name.trim()) {
    data.name = body.name.trim()
  }
  if (typeof body.note === 'string') {
    data.note = body.note.trim()
  }

  const updated = await updateGroup(id, data)
  if (!updated) {
    return NextResponse.json({ error: '分组不存在' }, { status: 404 })
  }
  return NextResponse.json(updated)
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: '缺少分组 id' }, { status: 400 })
  }
  const ok = await deleteGroup(id)
  if (!ok) {
    return NextResponse.json({ error: '分组不存在' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
