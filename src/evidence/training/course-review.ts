import { escape } from '../view'
import { courseRevisions } from './courses'

export function courseReview(id: string, adopted: number | null) {
 const revisions = courseRevisions.filter(c => c.id === id).sort((a,b) => b.revision-a.revision)
 return revisions.map(c => `<details><summary>Review revision ${c.revision}${adopted === c.revision ? ' (adopted)' : ''}</summary>${c.lessons.map(l => `<h3>${escape(l.title)}</h3><p>${escape(l.text)}</p>`).join('')}<h3>Assessment</h3><ol>${c.quiz.map(q => `<li>${escape(q.q)}<ul>${q.options.map((option,index) => `<li>${escape(option)}${index === q.answer ? ' — correct answer' : ''}</li>`).join('')}</ul></li>`).join('')}</ol>${adopted === null || adopted < c.revision ? `<form method="post" action="/app/training/courses/${c.id}/adopt"><input type="hidden" name="revision" value="${c.revision}"><button class="button-secondary">Adopt revision ${c.revision}</button></form>` : ''}</details>`).join('')
}
