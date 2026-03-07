import { Panel, useReactFlow } from '@xyflow/react'
import { LayoutGrid, Lock, LockOpen, Maximize2, Minus, Plus } from 'lucide-react'
import { composeButtonClass } from '../../ui/buttonStyles'

type CanvasToolbarProps = {
  locked: boolean
  onLockToggle: () => void
  onAutoLayout: () => void
}

const buttonClassName = composeButtonClass({ variant: 'primary', size: 'icon' })

export function CanvasToolbar({ locked, onLockToggle, onAutoLayout }: CanvasToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  return (
    <Panel className="mb-4 ml-4 z-30" position="bottom-left">
      <div
        className="pointer-events-auto flex flex-col gap-2 rounded-2xl border border-[color:var(--color-panel-border)] bg-[color:var(--color-panel)]/75 p-2 backdrop-blur-sm"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          aria-label="Zoom in"
          className={`${buttonClassName} cursor-pointer`}
          onClick={() => zoomIn({ duration: 180 })}
          title="Zoom in"
          type="button"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          aria-label="Zoom out"
          className={`${buttonClassName} cursor-pointer`}
          onClick={() => zoomOut({ duration: 180 })}
          title="Zoom out"
          type="button"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          aria-label="Center view"
          className={`${buttonClassName} cursor-pointer`}
          onClick={() => fitView({ duration: 220, padding: 0.2 })}
          title="Center view"
          type="button"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <button
          aria-label="Auto layout"
          className={`${buttonClassName} cursor-pointer`}
          onClick={onAutoLayout}
          title="Auto layout"
          type="button"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <button
          aria-label={locked ? 'Unlock canvas' : 'Lock canvas'}
          className={`${buttonClassName} cursor-pointer`}
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
