import type { ReactNode } from 'react'

export function Slab({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`slab acrylic-slab ${className}`}><span className="acrylic-light" aria-hidden="true" /><span className="acrylic-depth" aria-hidden="true" /><div className="card acrylic-face">{children}</div></div>
}
export function Chip({ children, state = 'covered' }: { children: ReactNode; state?: 'covered' | 'due' | 'overdue' | 'missing' }) {
  return <span className={`drawing-chip chip-${state}`}><span aria-hidden="true" />{children}</span>
}
