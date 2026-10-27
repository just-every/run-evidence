import { page, escape } from './view'
// Human routes retain their status and explain a refusal in the app's frame.
export function problem(message: string, status: number, back = '/app', member = false) {
 const title = status === 401 ? 'Sign in required' : status === 403 ? 'Access unavailable' : status === 404 ? 'Page not found' : 'Could not complete request'
 return page(title, `<p role="alert">${escape(message)}</p><p><a href="${escape(status === 401 ? '/signin?returnTo=' + encodeURIComponent(back) : back)}">${status === 401 ? 'Sign in' : member ? 'Back to my tasks' : 'Go back'}</a></p>`, status, { member })
}
