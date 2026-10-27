# Licensed supplier questionnaires

Vendors offers SIG Lite, SIG Core and CSA CAIQ v4 template types. Their text is
not bundled. Import a licensed XLSX or XLSM workbook, name its edition (a SIG
year or CAIQ 4.0.x), name the licensee and confirm the licence in the signed-in
owner session. Every workbook needs that confirmation, regardless of its name.
Owner-built pasted questionnaires also require a wording-rights confirmation.

Choose the question worksheet and its physical header row. Map the workbook's
exact column headers to id, domain and question, plus its scoping rule, in_scope
decision, answer, comment, SSRM ownership and implementation-description columns.
The defaults use those field names. Each import preserves question ids, domains,
text, original row values, scoping rules and decisions, edition, licensee,
confirming person and time, column mapping and file fingerprint. Imports are
new templates; issuing a request snapshots its questions and edition.

Export a scoped copy from the licensed authoring tool first. Evidence does not
execute Excel macros: a rule-bearing row needs an explicit yes/no in_scope
value. Out-of-scope ids stay in the template and request but need no response.
Imports admit up to 10,000 questions and a 10 MiB workbook. Blank or duplicate
question ids, incomplete rows and an entirely excluded scope are refused.

A supplier can answer the in-scope questions in the private link or upload its
completed workbook. Keep the requested edition, question ids, wording, domains
and scoping decisions unchanged. SIG accepts yes/no/not applicable with comment;
CAIQ also retains SSRM ownership and implementation descriptions. Final receipt
requires every in-scope answer and the respondent's unverified name and email.
The completed workbook remains an immutable supplier-provided document; answers
remain unverified statements. Earlier answers and original files remain intact.

The bundled 197-question set is **CCM v4 control questionnaire (Evidence
wording)**. It is not the licensed CSA CAIQ questionnaire. Previously issued
requests for that bundled set receive the corrected label without changing any
question or answer.

Supplier pages send Cache-Control: no-store and Referrer-Policy: no-referrer.
The expiring token is the credential; no owner session or Origin is required.
Cross-site Sec-Fetch-Site requests are refused before writing. The owner can
close a link immediately. Audit and link-event records carry opaque link ids,
not the bearer token. Custody exports omit token digests and restore links closed.
