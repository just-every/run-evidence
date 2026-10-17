// Line icons for the run site's cards (24 px grid, 2 px stroke in currentColor). None is a
// third-party logo: integrations are named in text, except Rippling and Jamf (public/site/brands).
import type { ReactElement } from 'react'

const paths: Record<string, ReactElement> = {
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /><path d="M12 14.6v2.2" /></>,
  bars: <><path d="M6 19v-5" /><path d="M12 19V9.5" /><path d="M18 19V5" /></>,
  people: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><circle cx="16.8" cy="9.6" r="2.6" /><path d="M16.2 14.3a4.6 4.6 0 0 1 4.6 5.2" /></>,
  shield: <><path d="M12 3.2 19 6v5.4c0 4.5-3 8-7 9.4-4-1.4-7-4.9-7-9.4V6z" /></>,
  shieldHalf: <><path d="M12 3.2 19 6v5.4c0 4.5-3 8-7 9.4-4-1.4-7-4.9-7-9.4V6z" /><path d="M12 7.5v9.6c-2.2-.9-3.6-3-3.6-5.6V9.1z" fill="currentColor" stroke="none" /></>,
  bucket: <><path d="M4.5 7h15l-1.8 12.2a1.6 1.6 0 0 1-1.6 1.3H7.9a1.6 1.6 0 0 1-1.6-1.3z" /><ellipse cx="12" cy="7" rx="7.5" ry="2.4" /><path d="M14.5 13.5h5" /></>,
  laptop: <><rect x="5" y="5.5" width="14" height="9.5" rx="1.5" /><path d="M2.8 18.5h18.4" /></>,
  doc: <><path d="M14 3H7.5A1.5 1.5 0 0 0 6 4.5v15A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7z" /><path d="M14 3v4h4" /><path d="M9 11.5h6M9 14.5h6M9 17.5h4" /></>,
  check: <path d="m6.5 12.4 3.6 3.6 7.4-7.6" />,
  alert: <><path d="M12 6.6v7" /><path d="M12 17.4v.1" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  branch: <><circle cx="6.5" cy="5.5" r="2" /><circle cx="6.5" cy="18.5" r="2" /><circle cx="17.5" cy="8" r="2" /><path d="M6.5 7.5v9M17.5 10c0 4-4 4.5-11 6.5" /></>,
  cloud: <path d="M7.5 18.5h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7.5 18.5z" />,
  apps: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" /></>,
  key: <><circle cx="8" cy="15.5" r="3.8" /><path d="m10.8 12.8 8.2-8.2M16 7.6l2.5 2.5M13.8 9.8l1.8 1.8" /></>,
  database: <><ellipse cx="12" cy="6" rx="7" ry="2.8" /><path d="M5 6v12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6" /><path d="M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" /></>,
  upload: <><path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9" /><path d="M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15" /></>,
  folder: <path d="M3.5 7.2A1.7 1.7 0 0 1 5.2 5.5h4.3l2 2.2h7.3a1.7 1.7 0 0 1 1.7 1.7v8.9a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7z" />,
  register: <><rect x="5.5" y="3.5" width="13" height="17" rx="1.8" /><path d="M9 8h6M9 11.5h6M9 15h3" /><path d="M14.5 17.5h4v3h-2.2a1.8 1.8 0 0 1-1.8-1.8z" fill="currentColor" stroke="none" /></>,
  userPlus: <><circle cx="10" cy="8.5" r="3.4" /><path d="M3.8 19.5a6.2 6.2 0 0 1 12.4 0" /><path d="M19 8v6M16 11h6" /></>,
  receipt: <><path d="M13.8 3H7.5A1.5 1.5 0 0 0 6 4.5v15A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7.2z" /><path d="M13.8 3v4.2H18" /><path d="M9.5 12h5M9.5 15.5h5" /></>,
  sparkle: <path d="M12 2.8c.7 4.6 2.6 6.6 7.2 7.2-4.6.7-6.5 2.6-7.2 7.2-.7-4.6-2.6-6.5-7.2-7.2 4.6-.6 6.5-2.6 7.2-7.2z" fill="currentColor" stroke="none" />,
  arrow: <path d="M4 12h15m-5-5 5 5-5 5" />,
}

export type IconName = keyof typeof paths

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

/** A filled status disc: green check, red exclamation or amber clock. */
export function Status({ kind, label }: { kind: 'pass' | 'fail' | 'wait'; label: string }) {
  return <span className={`status status-${kind}`} role="img" aria-label={label}>{kind === 'wait' ? <Icon name="clock" /> : <Icon name={kind === 'pass' ? 'check' : 'alert'} />}</span>
}
