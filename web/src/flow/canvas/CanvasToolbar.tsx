import { Panel, useReactFlow } from '@xyflow/react'
import { LayoutGrid, Lock, LockOpen, Maximize2, Minus, Plus } from 'lucide-react'

type CanvasToolbarProps = {
  locked: boolean
  onLockToggle: () => void
  onAutoLayout: () => void
}

const buttonClassName =
  'group flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--color-panel-border)] bg-[color:var(--color-panel)]/90 text-[color:var(--color-text-secondary)] shadow-[0_10px_24px_var(--color-chat-shadow)] transition hover:border-[color:var(--color-control-bg)] hover:text-[color:var(--color-text-primary)]'

export function CanvasToolbar({ locked, onLockToggle, onAutoLayout }: CanvasToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  return (
    <Panel className="mb-4 ml-4" position="bottom-left">
      <div className="flex flex-col gap-2" onMouseDown={(event) => event.stopPropagation()}>
        <button
          aria-label="Zoom in"
          className={buttonClassName}
          onClick={() => zoomIn({ duration: 180 })}
          title="Zoom in"
          type="button"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          aria-label="Zoom out"
          className={buttonClassName}
          onClick={() => zoomOut({ duration: 180 })}
          title="Zoom out"
          type="button"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          aria-label="Center view"
          className={buttonClassName}
          onClick={() => fitView({ duration: 220, padding: 0.2 })}
          title="Center view"
          type="button"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <button
          aria-label="Auto layout"
          className={buttonClassName}
          onClick={onAutoLayout}
          title="Auto layout"
          type="button"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <button
          aria-label={locked ? 'Unlock canvas' : 'Lock canvas'}
          className={buttonClassName}
          onClick={onLockToggle}
          title={locked ? 'Unlock canvas' : 'Lock canvas'}
          type="button"
        >
          {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
        </button>
      </div>
    </Panel>
  )
}
