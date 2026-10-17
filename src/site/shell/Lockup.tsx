/** The header lockup: the mark and the "Evidence" wordmark in the heading face. */
export function Lockup({ href = '/', className = '' }: { href?: string; className?: string }) {
  return <a className={`site-brand ${className}`.trim()} href={href}><img src="/brand/mark.svg" width="40" height="40" alt="" /><span>Evidence</span></a>
}
