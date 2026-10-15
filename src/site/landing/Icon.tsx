export type IconName = 'list' | 'image' | 'folder' | 'document' | 'upload' | 'pencil' | 'arrow' | 'calendar' | 'database' | 'people'
const paths: Record<IconName, React.ReactNode> = {
  list: <><path d="M9 7h12M9 12h12M9 17h9" /><path d="M4 7h.01M4 12h.01M4 17h.01" strokeWidth="3" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8" cy="8" r="1.4" /><path d="m3 18 6-6 4 4 4-6 4 6" /></>,
  folder: <path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />,
  document: <><path d="M5 2h9l5 5v15H5Z M14 2v6h5" /><path d="M9 12h6M9 16h6M9 19h4" /></>,
  upload: <><path d="M3 14v6h18v-6M12 16V2m-6 6 6-6 6 6" /></>,
  pencil: <><path d="M12 3H4v18h8M15 3l6 6M10 20l2-6 7-7a2.1 2.1 0 0 1 3 3l-7 7Z" /></>,
  arrow: <path d="M3 12h18M13 4l8 8-8 8" />,
  calendar: <><rect x="3" y="5" width="18" height="17" rx="2" /><path d="M7 2v6M17 2v6M3 11h18M7 15h.01M12 15h.01M17 15h.01M7 19h.01M12 19h.01" /></>,
  database: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0" /></>,
  people: <><circle cx="9" cy="7" r="4" /><path d="M2 21v-3a7 7 0 0 1 14 0v3M16 3a4 4 0 0 1 0 8M22 21v-3a7 7 0 0 0-4-6" /></>,
}
export function Icon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
export function IconTile({ name }: { name: IconName }) {
  return <span className="drawing-icon"><Icon name={name} /></span>
}
