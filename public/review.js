const button = document.querySelector('[data-copy-review]')
button?.addEventListener('click', async () => {
 const input = document.querySelector('#reviewer-link')
 const status = document.querySelector('#copy-status')
 if (!(input instanceof HTMLInputElement) || !status) return
 try {
  await navigator.clipboard.writeText(input.value)
  status.textContent = 'Link copied.'
 } catch {
  input.focus()
  input.select()
  status.textContent = 'Select and copy the link from the field above.'
 }
})
// Do not retain the one-time grant in the back/forward cache.
addEventListener('pagehide', () => {
 const input = document.querySelector('#reviewer-link')
 if (input instanceof HTMLInputElement) { input.value = ''; input.removeAttribute('value') }
 for (const link of document.querySelectorAll('a[href*="/review/"]')) link.removeAttribute('href')
})
