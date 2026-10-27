# PCI SAQ worksheets

Program → Documents → SAQ selection and worksheet records payment-channel
answers and selects the most demanding applicable SAQ type for confirmation
by the merchant or QSA. It is a preparation worksheet, not an assessment or an
attestation. PCI SSC text is licensed and is not distributed with Evidence.
Confirm eligibility, requirement wording, response instructions and the AOC
handoff against your licensed SAQ before using the worksheet.

Each row names an assessed PCI DSS v4.0.1 requirement id, an Evidence-written
prompt, the parent requirement's linked-control state, the owner's response,
linked controls and the response explanation. A parent control's state is not
proof that its every sub-requirement operated. Requirements outside the selected
SAQ are not included. Rows explicitly left blank in an SAQ, service-provider-only
placeholders in the merchant SAQ and 12.3.2 (not assessed through an SAQ) are not
response rows. A repeated continuation row retains a single question identity.

The source revisions are PCI SSC's October 2024 v4.0.1 SAQs for A-EP, B, B-IP,
C, C-VT, P2PE and D for Merchants; SAQ A revision 1 of January 2025; and SAQ D
for Service Providers revision 2 of January 2025. The factual id lists and source
references are in `src/evidence/program/documents/saq-scopes.json`; Evidence's
wording is in `saq-wording.ts`. The PCI SSC [document catalogue](https://www.pcisecuritystandards.org/document_library/)
is authoritative for subsequent revisions. Requirement ids and our prompts are
not copies of the licensed requirement or testing text.

SAQ A's January 2025 revision is a reviewable change in Control library revision
3. An installation remains on its accepted October 2024 scope until its owner
reviews and accepts that change. The change removes 6.4.3, 11.6.1 and 12.3.1 from
SAQ A and calls for confirming the changed eligibility criteria. Affected approved
worksheets then show Needs review; reconciliation creates a new revision. Earlier
approved documents remain retrievable and exportable. Future SAQ updates must
likewise carry a reviewed source revision, explicit scope changes and document
drift facts before they ship.

The shorter SAQs offer in place, in place with CCW, not applicable and not in
place. D additionally offers not tested. Approval requires a valid response to
every displayed id. A non-in-place response also needs its explanation: scope
justification for not applicable, the compensating-controls worksheet's
constraint/objective/risk/controls/validation/maintenance for CCW, a testing
limitation for not tested, or the remediation plan for not in place. Evidence
checks that an explanation is present; the merchant or QSA judges its adequacy.
The worksheet and AOC handoff both name the source revision and licensed-document
confirmation, and Evidence signs neither.
