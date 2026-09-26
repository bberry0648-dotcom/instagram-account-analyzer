import { useEffect, useRef, useState } from 'react'
import { Button, Icon } from '../../components/ui'
import { accountPath, navigate } from '../../lib/router'
import { addRecent, saveImported } from '../../lib/storage'
import { ImportError, parseImport } from './parseImport'

const CSV_TEMPLATE =
  'permalink,timestamp,media_type,caption,like_count,comments_count,view_count,thumbnail_url\n' +
  'https://www.instagram.com/reel/XXXX/,2026-09-01T10:00:00Z,REELS,"캡션 텍스트",1200,34,15000,\n'

export function ImportDialog({ onClose, defaultUsername = '' }: { onClose: () => void; defaultUsername?: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [username, setUsername] = useState(defaultUsername)
  const [followers, setFollowers] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    // No close() in cleanup: it would fire onClose and, under StrictMode's re-run, dismiss the dialog at once.
    const d = dialogRef.current
    if (d && !d.open) d.showModal()
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      setError('파일을 선택해 주세요.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('8MB 이하 파일만 가져올 수 있습니다.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const text = await file.text()
      const f = followers.replace(/[,\s]/g, '')
      if (f && !/^\d+$/.test(f)) throw new ImportError('팔로워 수는 숫자로 입력해 주세요.')
      const ds = parseImport(text, file.name, new Date(file.lastModified), {
        username: username.trim() || undefined,
        followersCount: f ? Number(f) : undefined,
      })
      const persisted = saveImported(ds)
      if (!persisted) ds.source.notes.push('브라우저 저장 공간이 부족해 새로고침하면 가져온 데이터가 사라집니다.')
      addRecent({ username: ds.profile.username, source: 'imported', analyzedAt: new Date().toISOString() })
      onClose()
      navigate(accountPath('imported', ds.profile.username))
    } catch (err) {
      setError(err instanceof ImportError ? err.message : '파일을 읽지 못했습니다. 형식을 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40"
    >
      <form onSubmit={submit} className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">데이터 가져오기</h2>
            <p className="mt-1 text-xs text-ink-3">
              API로 조회할 수 없는 계정은 직접 확보한 데이터로 분석합니다. 파일은 이 브라우저에만 저장되고 서버로 전송되지 않습니다.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="-m-1 p-1 text-ink-3 hover:text-ink">
            <Icon name="x" />
          </button>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong px-4 py-6 text-center hover:bg-surface-2">
          <Icon name="upload" className="size-5 text-ink-3" />
          <span className="text-sm font-medium">{file ? file.name : 'JSON 또는 CSV 파일 선택'}</span>
          <span className="text-xs text-ink-3">Meta Graph API 응답 JSON · 이 앱의 JSON · CSV</span>
          <input
            type="file"
            accept=".json,.csv,application/json,text/csv"
            className="sr-only"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setError(null)
            }}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-ink-2">
            Username <span className="text-ink-3">(파일에 없으면 필수)</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@account"
              autoCapitalize="off"
              autoCorrect="off"
              className="mt-1 h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-base text-ink outline-none focus:border-accent sm:text-sm"
            />
          </label>
          <label className="text-xs text-ink-2">
            팔로워 수 <span className="text-ink-3">(선택 · 참여율 계산용)</span>
            <input
              value={followers}
              onChange={(e) => setFollowers(e.target.value)}
              inputMode="numeric"
              placeholder="비워 두면 참여율 제외"
              className="mt-1 h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-base text-ink outline-none focus:border-accent sm:text-sm"
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`}
            download="instagram-import-template.csv"
            className="text-xs font-medium text-accent-text hover:underline"
          >
            CSV 양식 받기
          </a>
          <div className="flex gap-2">
            <Button onClick={onClose}>취소</Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? '읽는 중…' : '가져와서 분석'}
            </Button>
          </div>
        </div>
      </form>
    </dialog>
  )
}
