import type { Course } from './courses'

// Retain the original curriculum and replace the changed lesson and question.
export function securityAwarenessUpdate(original: Course): Course {
 return {
  ...original, revision: 2,
  lessons: original.lessons.map((lesson, index) => index === 0 ? {
   ...lesson,
   text: lesson.text + ' A familiar voice is not proof of identity: attackers can imitate a colleague using recorded speech. If a caller requests a payment, credentials or an urgent exception, end the call and contact the person using a known company directory number. Do not use a number supplied by the caller. Follow the normal approval process and report the request.',
  } : lesson),
  quiz: original.quiz.map((question, index) => index === 0 ? {
   q: 'A caller sounds exactly like your CEO and asks for an urgent payment outside the approval process. What do you do?',
   options: ['End the call, verify using a known directory number and report the request', 'Approve because you recognize the voice', 'Call the number the caller supplies', 'Send a small payment to confirm their identity'],
   answer: 0,
  } : question),
 }
}
