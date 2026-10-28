# Carried-done audit at `c252c8f42873fc076c22ba9e50105e69eb8bf6e6`

Every acceptance point of every part of a clause that was done at `c252c8f42873fc076c22ba9e50105e69eb8bf6e6` (the old reference both `docs/contract/ID-MAP.json` and `docs/contract/COVERAGE.json` name), one row per named outcome. **Asserting test** is the line of the assertion in a file the clause's Status Evidence cell lists. **Result** is `asserted`, `none` (the clause is partial and its Gap names the outcome) or `moved` (a proof boundary moved to the Requirement or the Field proof register). The harness `clock` call restarts workerd, so assertions after it count as after a restart.

| Clause | Point | Outcome | Asserting test | Result |
| --- | ---: | --- | --- | --- |
| `PROOF-001` | 1 | Caller-forged origin, actor, time and digest are ignored; the receipt records manually-asserted origin, the server time and the signed-in actor | `tests/evidence.mjs:52` | asserted |
| `PROOF-001` | 1 | An exhibit is replaced by an explicit supersession that points to the original | `tests/evidence.mjs:84` | asserted |
| `PROOF-001` | 1 | The original receipt reloads with its facts unchanged | `tests/evidence.mjs:85` | asserted |
| `PROOF-001` | 1 | Both versions download (the original, and the replacement as an inert attachment) | `tests/evidence.mjs:86` | asserted |
| `PROOF-001` | 1 | The replacement downloads as an attachment with nosniff | `tests/evidence.mjs:88` | asserted |
| `PROOF-001` | 2 | A second replacement of the same receipt is refused | `tests/evidence.mjs:87` | asserted |
| `PROOF-001` | 2 | An oversized upload is refused with 413 and creates no receipt | `tests/evidence.mjs:59` | asserted |
| `PROOF-001` | 2 | A changed object reads as unavailable bytes and its download is refused | `tests/evidence.mjs:95` | asserted |
| `PROOF-001` | 2 | A missing object reads as unavailable bytes while both receipts are retained | `tests/evidence.mjs:96` | asserted |
| `PROOF-001` | 2 | Unsafe writes to receipts and exhibits are refused | `tests/evidence.mjs:89` | asserted |
| `GAP-001` | 1 | Daily period advances covered to due soon to overdue across its deadline | `tests/evidence.mjs:66` | asserted |
| `GAP-001` | 1 | Weekly, monthly and quarterly periods advance covered to due soon to overdue | `tests/evidence.mjs:75` | asserted |
| `GAP-001` | 1 | A superseded period reads superseded-only | `tests/evidence.mjs:86` | asserted |
| `GAP-001` | 1 | Imported-only proof never reads covered — asserted only in tests/import.mjs:62, which GAP-001 does not cite | none | none |
| `GAP-001` | 1 | Changed or missing R2 bytes read as unavailable bytes | `tests/evidence.mjs:95` | asserted |
| `GAP-001` | 2 | A completed historical period keeps its original state | `tests/evidence.mjs:67` | asserted |
| `REVIEW-001` | 1 | The owner issues a folder | `tests/review.mjs:19` | asserted |
| `REVIEW-001` | 1 | The reviewer page lists exactly the in-period exhibits of the selected control | `tests/review.mjs:59` | asserted |
| `REVIEW-001` | 1 | In-period exhibits download | `tests/review.mjs:62` | asserted |
| `REVIEW-001` | 2 | A crossing-period receipt is refused | `tests/review.mjs:60` | asserted |
| `REVIEW-001` | 2 | A foreign control's receipt is refused | `tests/review.mjs:61` | asserted |
| `REVIEW-001` | 2 | A write is refused | `tests/review.mjs:80` | asserted |
| `REVIEW-001` | 2 | An altered token is refused with the same plain 404 | `tests/review.mjs:92` | asserted |
| `REVIEW-001` | 2 | Expiry during a read refuses disclosure | `tests/review.mjs:132` | asserted |
| `REVIEW-001` | 2 | A closed folder refuses every door | `tests/review.mjs:98` | asserted |
| `REVIEW-001` | 3 | Owner event history retains allowed attempts | `tests/review.mjs:191` | asserted |
| `REVIEW-001` | 3 | Owner event history retains refused attempts | `tests/review.mjs:192` | asserted |
| `REVIEW-001` | 3 | Event history holds no token or raw link | `tests/review.mjs:190` | asserted |
| `IMPORT-001` | 1 | A documented-shape Drata ZIP is inspected in a dry run with truthful counts | `tests/import.mjs:34` | asserted |
| `IMPORT-001` | 1 | Mappings are reviewed before admission | `tests/import.mjs:50` | asserted |
| `IMPORT-001` | 1 | Unsafe and malformed artifacts are refused without writes | `tests/import.mjs:44` | asserted |
| `IMPORT-001` | 1 | Admission completes with a journal | `tests/import.mjs:56` | asserted |
| `IMPORT-001` | 1 | Undo removes the active links | `tests/import.mjs:80` | asserted |
| `IMPORT-001` | 2 | Originals and import history remain after undo | `tests/import.mjs:84` | asserted |
| `IMPORT-001` | 2 | Import history remains after a restart (the harness clock restarts workerd) | `tests/import.mjs:113` | asserted |
| `IMPORT-001` | 2 | Original artifacts remain after a restart | none | none |
| `IMPORT-001` | 2 | Originals and import history remain after archive restore | `tests/import.mjs:69` | asserted |
| `CUSTODY-001` | 1 | The archive exports | `tests/archive.mjs:63` | asserted |
| `CUSTODY-001` | 1 | The manifest is inspected against its digest | `tests/archive.mjs:67` | asserted |
| `CUSTODY-001` | 1 | A dry-run restore writes nothing | `tests/archive.mjs:104` | asserted |
| `CUSTODY-001` | 1 | Restore into an empty real D1/R2 succeeds | `tests/archive.mjs:106` | asserted |
| `CUSTODY-001` | 1 | Every portable record compares equal | `tests/archive.mjs:108` | asserted |
| `CUSTODY-001` | 1 | Every available byte compares equal by digest | `tests/archive.mjs:112` | asserted |
| `CUSTODY-001` | 2 | An altered digest is refused (manifest digest and same-size file digest cases) | `tests/archive.mjs:90` | asserted |
| `CUSTODY-001` | 2 | Traversal and unsafe paths are refused | `tests/archive.mjs:90` | asserted |
| `CUSTODY-001` | 2 | Missing and unlisted files are refused | `tests/archive.mjs:90` | asserted |
| `CUSTODY-001` | 2 | Unavailable bytes stay listed as unavailable in the export | `tests/archive.mjs:70` | asserted |
| `CUSTODY-001` | 2 | Unavailable bytes stay unavailable after restore | `tests/archive.mjs:114` | asserted |
| `CUSTODY-001` | 2 | A nonempty target is refused | `tests/archive.mjs:95` | asserted |
| `CUSTODY-001` | 3 | A refusal leaves the target empty or unchanged | `tests/archive.mjs:90` | asserted |
| `CUSTODY-001` | 3 | A successful restore leaves reviewer grants closed with no token | `tests/archive.mjs:110` | asserted |
| `CUSTODY-001` | 3 | A restored reviewer link no longer opens | `tests/archive.mjs:113` | asserted |
| `AGENT-001` | 1 | The owner issues a prepare token | `tests/agent.mjs:44` | asserted |
| `AGENT-001` | 1 | The agent inspects gaps on the desk | `tests/agent.mjs:57` | asserted |
| `AGENT-001` | 1 | The agent proposes a folder with a frozen snapshot | `tests/agent.mjs:67` | asserted |
| `AGENT-001` | 2 | Direct sharing (creating a folder) with the prepare-only token is refused | `tests/agent.mjs:50` | asserted |
| `AGENT-001` | 2 | An owner-only mutation with the prepare-only token is refused | `tests/agent.mjs:49` | asserted |
| `AGENT-001` | 2 | Approval with the prepare-only token is refused, even with an ambient owner cookie | `tests/agent.mjs:80` | asserted |
| `AGENT-001` | 2 | Approval of a stale snapshot with the owner session is refused | `tests/agent.mjs:104` | asserted |
| `AGENT-001` | 3 | Under the prepare-only grant, the owner approves the current snapshot once | `tests/agent.mjs:83` | asserted |
| `AGENT-001` | 3 | The owner revisits the decision with its actor and exact snapshot, and it cannot be removed | `tests/agent.mjs:84` | asserted |
| `AGENT-001` | 3 | The revoked prepare-only token can no longer inspect or prepare | `tests/agent.mjs:116` | asserted |
| `PROGRAM-001` | 1 | Each of the four core programs is created | `tests/program.mjs:38` | asserted |
| `PROGRAM-001` | 1 | Two scoped products are recorded | `tests/program.mjs:41` | asserted |
| `PROGRAM-001` | 1 | A program carries its own audit period | `tests/program.mjs:46` | asserted |
| `PROGRAM-001` | 1 | Applicability is reviewed with an assessor and the review is fingerprinted | `tests/program.mjs:54` | asserted |
| `PROGRAM-001` | 1 | A framework edition is upgraded | `tests/program.mjs:62` | asserted |
| `PROGRAM-001` | 2 | Owners survive the export | none | none |
| `PROGRAM-001` | 2 | Exclusions survive the export | `tests/program.mjs:65` | asserted |
| `PROGRAM-001` | 2 | Edition history survives the export | `tests/program.mjs:62` | asserted |
| `PROGRAM-001` | 2 | Unresolved obligations survive the export | `tests/program.mjs:46` | asserted |
| `PROGRAM-001` | 2 | Excluded work is visible | `tests/program.mjs:44` | asserted |
| `PROGRAM-001` | 2 | No certification is asserted | `tests/program.mjs:46` | asserted |
| `PROGRAM-003` | 1 | Each core program generates its documents (SOC 2, ISO, HIPAA and PCI document sets) | `tests/helpers/program-documents-journey.mjs:41` | asserted |
| `PROGRAM-003` | 1 | A revision is edited | `tests/helpers/program-documents-journey.mjs:52` | asserted |
| `PROGRAM-003` | 1 | A revision is approved with its review deadline | `tests/helpers/program-documents-journey.mjs:60` | asserted |
| `PROGRAM-003` | 1 | The system description exports as DOCX | `tests/helpers/program-documents-journey.mjs:73` | asserted |
| `PROGRAM-003` | 1 | The system description exports as PDF | `tests/helpers/program-documents-journey.mjs:65` | asserted |
| `PROGRAM-003` | 1 | The SoA exports as XLSX | `tests/helpers/program-documents-journey.mjs:84` | asserted |
| `PROGRAM-003` | 1 | The SoA exports as PDF | `tests/helpers/program-documents-journey.mjs:85` | asserted |
| `PROGRAM-003` | 1 | The risk analysis exports as PDF | `tests/helpers/program-documents-journey.mjs:117` | asserted |
| `PROGRAM-003` | 1 | The SAQ worksheet exports as PDF | `tests/helpers/program-documents-journey.mjs:161` | asserted |
| `PROGRAM-003` | 2 | A document that drifts from program state needs review, and a reconciliation writes a new revision | `tests/helpers/program-documents-journey.mjs:69` | asserted |
| `PROGRAM-003` | 3 | The SOC 2 description cites the inventory revision it pre-filled from | `tests/helpers/program-documents-journey.mjs:47` | asserted |
| `PROGRAM-003` | 3 | The SOC 2 description cites the policy revision it pre-filled from | `tests/helpers/program-documents-journey.mjs:48` | asserted |
| `PROGRAM-003` | 4 | Starting the HIPAA risk analysis adds the RISK-002 library scenarios inside the document | `tests/helpers/program-documents-journey.mjs:107` | asserted |
| `PROGRAM-003` | 4 | The added scenarios appear in the analysis as cited risks | `tests/helpers/program-documents-journey.mjs:111` | asserted |
| `PROGRAM-005` | 1 | The SoA lists all 93 Annex A:2022 controls | `tests/helpers/program-documents-journey.mjs:79` | asserted |
| `PROGRAM-005` | 1 | The SoA's exclusions match applicability | `tests/helpers/program-documents-journey.mjs:83` | asserted |
| `PROGRAM-005` | 2 | An internal audit with one nonconformity and corrective action is recorded | `tests/helpers/program-documents-journey.mjs:91` | asserted |
| `PROGRAM-005` | 2 | A management review is recorded | `tests/helpers/program-documents-journey.mjs:92` | asserted |
| `PROGRAM-005` | 3 | Failing a test on an implemented control makes the SoA need review | `tests/helpers/program-documents-journey.mjs:100` | asserted |
| `PROGRAM-005` | 3 | The SoA drift names the implemented control | `tests/helpers/program-documents-journey.mjs:101` | asserted |
| `PROGRAM-005` | 3 | The approved prior revision stays retrievable | `tests/helpers/program-documents-journey.mjs:102` | asserted |
| `PROGRAM-006` | 1 | Switching the SAQ answers changes the selected type and worksheet | `tests/helpers/program-documents-journey.mjs:150` | asserted |
| `PROGRAM-006` | 2 | The SAQ A worksheet lists only SAQ A's requirement ids | `tests/helpers/program-documents-journey.mjs:145` | asserted |
| `PROGRAM-006` | 2 | The SAQ A worksheet names its SAQ revision | `tests/helpers/program-documents-journey.mjs:146` | asserted |
| `PROGRAM-006` | 3 | A not-applicable response without its explanation blocks approval | `tests/helpers/program-documents-journey.mjs:154` | asserted |
| `PROGRAM-006` | 3 | A CCW response without its explanation blocks approval | `tests/helpers/program-documents-journey.mjs:156` | asserted |
| `LIBRARY-001` | 1 | Each core program on a fresh installation reports zero unmapped requirements | `tests/program.mjs:38` | asserted |
| `LIBRARY-001` | 1 | Every mapped control shows a test or an evidence requirement | `tests/program.mjs:40` | asserted |
| `LIBRARY-001` | 2 | The build-time check enumerates every program requirement | `scripts/library-check.mjs:15` | asserted |
| `LIBRARY-001` | 2 | The build-time check enumerates every listed connector evidence class | `scripts/library-check.mjs:59` | asserted |
| `LIBRARY-001` | 2 | It fails on a requirement with no control | `scripts/library-check.mjs:16` | asserted |
| `LIBRARY-001` | 2 | It fails on a control with neither test nor evidence requirement | `scripts/library-check.mjs:30` | asserted |
| `LIBRARY-001` | 2 | It fails on an evidence class with neither a shipped test nor an unsupported entry | `scripts/library-check.mjs:60` | asserted |
| `LIBRARY-001` | 2 | It fails on an unsupported entry that names no replacement evidence requirement | `scripts/library-check.mjs:45` | asserted |
| `LIBRARY-002` | 1 | The check fails on a test entry with no remediation steps for a provider it runs against | `scripts/library-check.mjs:39` | asserted |
| `LIBRARY-002` | 1 | The check fails on a configuration test with neither a Terraform snippet nor a stated absence | `scripts/library-check.mjs:40` | asserted |
| `LIBRARY-002` | 2 | A failing AWS S3 public-access test | `tests/cloud.mjs:139` | asserted |
| `LIBRARY-002` | 2 | A failing Vercel deployment-protection test — no Vercel connector exists; CLOUD-002 is missing | none | none |
| `LIBRARY-002` | 2 | The Results page shows the How to remediate panel for its own provider | `tests/cloud.mjs:145` | asserted |
| `LIBRARY-002` | 2 | The AWS entry includes a Terraform snippet | `tests/cloud.mjs:145` | asserted |
| `LIBRARY-002` | 2 | Applying the snippet makes the next run pass — the fixture fixes the bucket at the provider edge; no snippet is applied, and a live account is R-1 | none | none |
| `LIBRARY-003` | 1 | Two connected hours leave at least two runs of every configuration test | `tests/cloud.mjs:180` | asserted |
| `LIBRARY-003` | 2 | A paused scheduler hour shows as a stale interval, not a carried-forward pass | `tests/cloud.mjs:185` | asserted |
| `LIBRARY-004` | 1 | A library revision is accepted with a reason | `tests/github.mjs:208` | asserted |
| `LIBRARY-004` | 1 | Earlier observations keep the revision they were evaluated under | `tests/github.mjs:219` | asserted |
| `LIBRARY-005` | 1 | One passing observation makes every mapped requirement pass in SOC 2, ISO 27001 and HIPAA | `tests/github.mjs:194` | asserted |
| `LIBRARY-005` | 1 | The store holds exactly one observation | `tests/github.mjs:190` | asserted |
| `LIBRARY-005` | 1 | No evidence is copied | `tests/github.mjs:196` | asserted |
| `LIBRARY-005` | 2 | Failing the same test fails those requirements in all three programs | `tests/github.mjs:222` | asserted |
| `LIBRARY-005` | 2 | The failure is one new observation | `tests/github.mjs:220` | asserted |
| `PROGRAM-002` | 1 | One access-review control maps to SOC 2, ISO 27001 and HIPAA | `tests/program.mjs:76` | asserted |
| `PROGRAM-002` | 1 | An owner and a contributor are assigned | `tests/program.mjs:77` | asserted |
| `PROGRAM-002` | 1 | Period evidence attached once covers the control | `tests/program.mjs:78` | asserted |
| `PROGRAM-002` | 1 | All three programs' mappings show that proof as current | `tests/program.mjs:79` | asserted |
| `PROGRAM-002` | 2 | Removing an asset with a reason keeps earlier denominators and the changed-definition label in the audit-period report | `tests/program.mjs:86` | asserted |
| `CONTROL-001` | 1 | A custom production-access control is created through the control form | `tests/helpers/control-journey.mjs:8` | asserted |
| `CONTROL-001` | 1 | Two evidence requirements are added | `tests/helpers/control-journey.mjs:15` | asserted |
| `CONTROL-001` | 1 | A custom framework mapping is added and exported | `tests/helpers/control-journey.mjs:47` | asserted |
| `CONTROL-001` | 1 | Test intent is revised after a failed observation | `tests/helpers/control-journey.mjs:25` | asserted |
| `CONTROL-001` | 1 | Both revisions appear in the historical report | `tests/helpers/control-journey.mjs:38` | asserted |
| `CONTROL-001` | 2 | The earlier failure keeps its original meaning | `tests/helpers/control-journey.mjs:35` | asserted |
| `CONTROL-002` | 1 | The 80-row XLSX dry run refuses one duplicate requirement ID and one unknown control ID | `tests/helpers/framework-journey.mjs:33` | asserted |
| `CONTROL-002` | 1 | Nothing is admitted until confirmed | `tests/helpers/framework-journey.mjs:34` | asserted |
| `CONTROL-002` | 2 | Confirming admits 78 requirements and readiness counts the unmapped ones | `tests/helpers/framework-journey.mjs:45` | asserted |
| `CONTROL-002` | 2 | Requirements mapped in the file show their controls | `tests/helpers/framework-journey.mjs:46` | asserted |
| `CONTROL-002` | 3 | The re-import review lists exactly the three changed and one removed requirements | `tests/helpers/framework-journey.mjs:55` | asserted |
| `CONTROL-002` | 3 | After confirmation the removed requirement remains in history | `tests/helpers/framework-journey.mjs:59` | asserted |
| `CONTROL-002` | 3 | Its earlier observations remain unchanged | `tests/helpers/framework-journey.mjs:60` | asserted |
| `CONTROL-002` | 3 | Approving two proposed mappings and rejecting one (inherited by AGENT-006 before its proposals ship) — moved to the Requirement and to AGENT-006 point 4 | none | moved |
| `READINESS-001` | 1 | Current and prior audit periods are compared from their own snapshots | `tests/readiness.mjs:126` | asserted |
| `READINESS-001` | 1 | A stale connector shows in the comparison | `tests/readiness.mjs:95` | asserted |
| `READINESS-001` | 1 | A failed test shows and is not ready | `tests/readiness.mjs:141` | asserted |
| `READINESS-001` | 1 | An accepted exception shows and never grants a pass | `tests/readiness.mjs:148` | asserted |
| `READINESS-001` | 1 | A missing policy attestation shows | `tests/readiness.mjs:154` | asserted |
| `READINESS-001` | 2 | Displayed totals drill to their records | `tests/helpers/readiness-browser.mjs:35` | asserted |
| `READINESS-001` | 2 | The report exports | `tests/readiness.mjs:29` | asserted |
| `READINESS-001` | 2 | Exported counts reconcile with the report | `tests/readiness.mjs:32` | asserted |
| `READINESS-001` | 2 | Period boundaries reconcile | `tests/readiness.mjs:39` | asserted |
| `READINESS-001` | 3 | A filtered read cannot create a passing result | `tests/readiness.mjs:100` | asserted |
| `READINESS-001` | 3 | A failed read cannot create a passing result | `tests/readiness.mjs:97` | asserted |
| `READINESS-001` | 4 | Readiness shows 94% for 47 of 50 ready requirements | `tests/readiness.mjs:81` | asserted |
| `READINESS-001` | 4 | It reads "47 of 50 requirements ready" | `tests/helpers/readiness-browser.mjs:30` | asserted |
| `READINESS-001` | 4 | It shows its calculation | `tests/readiness.mjs:58` | asserted |
| `READINESS-001` | 4 | The checklist lists policies, access reviews, vendor risk and trust center with their own counts | `tests/readiness.mjs:23` | asserted |
| `READINESS-001` | 5 | A stale passing collector drops the percentage to 92% | `tests/readiness.mjs:129` | asserted |
| `READINESS-001` | 6 | Making the remaining three ready shows 100% — asserted only inside `assertReadiness` in tests/helpers/readiness-fixture.mjs:97, which READINESS-001 does not cite | none | none |
| `READINESS-001` | 6 | No page or export uses the word certified | `tests/readiness.mjs:136` | asserted |
| `CADENCE-001` | 1 | An eight-month-old pentest report covers four months, not twelve — asserted only in tests/program.mjs:133, which CADENCE-001 does not cite | none | none |
| `CADENCE-001` | 2 | Advancing the clock moves the requirement to due soon with one reminder | `tests/cadence.mjs:58` | asserted |
| `CADENCE-001` | 2 | The due-soon reminder is not repeated across a restart (the harness clock restarts workerd) | `tests/cadence.mjs:58` | asserted |
| `CADENCE-001` | 2 | At the deadline it is overdue | `tests/cadence.mjs:63` | asserted |
| `CADENCE-001` | 2 | A deadline reminder is sent | `tests/cadence.mjs:32` | asserted |
| `CADENCE-001` | 3 | A semi-annual access review anchored to a 1 February audit window runs February–July and August–January — asserted only in tests/program.mjs:155 | none | none |
| `CADENCE-001` | 4 | An annual review anchors to a July fiscal year | `tests/cadence.mjs:56` | asserted |
| `CADENCE-001` | 5 | A one-off custom renewal date moves only the current deadline | `tests/cadence.mjs:40` | asserted |
| `CADENCE-001` | 5 | The next cycle returns to its anchor | `tests/cadence.mjs:43` | asserted |
| `CADENCE-001` | 6 | An imported annual report stays imported and does not establish current proof | none | none |
| `CADENCE-001` | 7 | A historical quarterly period and an annual period from before a period change keep their original state — asserted only in tests/program.mjs:160 | none | none |
| `CONNECT-001` | 1 | A provider is authorized through Connections after a real read | `tests/github.mjs:39` | asserted |
| `CONNECT-001` | 1 | The credential is rotated and the next read completes | `tests/github.mjs:94` | asserted |
| `CONNECT-001` | 1 | The credential is revoked | `tests/github.mjs:97` | asserted |
| `CONNECT-001` | 1 | A rejected credential needs reconnect and is reconnected | `tests/github.mjs:90` | asserted |
| `CONNECT-001` | 1 | Cross-tenant use of a receiving credential for another connection is refused | `tests/private-collector.mjs:85` | asserted |
| `CONNECT-001` | 1 | Export carries no credential | `tests/github.mjs:121` | asserted |
| `CONNECT-001` | 1 | Restore leaves the connection inactive with no secret | `tests/github.mjs:134` | asserted |
| `CONNECT-001` | 2 | Secrets never appear (stored only as ciphertext) | `tests/github.mjs:41` | asserted |
| `CONNECT-001` | 2 | The collector's credential never appears in connection detail or custody | `tests/private-collector.mjs:95` | asserted |
| `CONNECT-001` | 2 | Restored collectors remain inactive | `tests/private-collector.mjs:104` | asserted |
| `CONNECT-001` | 3 | An owner-reviewed private collector is installed and collects | `tests/private-collector.mjs:55` | asserted |
| `CONNECT-001` | 3 | Unsupported resources stay unknown and are listed | `tests/private-collector.mjs:66` | asserted |
| `CONNECT-001` | 3 | A lost connection fails visibly | `tests/private-collector.mjs:77` | asserted |
| `CONNECT-001` | 3 | The read-only output reconciles with the actual private source | `tests/private-collector.mjs:58` | asserted |
| `CONNECT-001` | 3 | The private source is left unchanged | `tests/private-collector.mjs:62` | asserted |
| `CONNECT-001` | 4 | Registration of the collector against an actual private local Git repository | `tests/private-collector.mjs:59` | asserted |
| `CONNECT-001` | 4 | Scoped receiving credentials bind one connection | `tests/private-collector.mjs:85` | asserted |
| `CONNECT-001` | 4 | Loss and recovery | `tests/private-collector.mjs:81` | asserted |
| `CONNECT-001` | 4 | Staleness turns missed reads unknown | `tests/private-collector.mjs:112` | asserted |
| `CONNECT-001` | 4 | Rotation and revocation take effect at once | `tests/private-collector.mjs:90` | asserted |
| `CONNECT-001` | 4 | Inactive archive restore | `tests/private-collector.mjs:106` | asserted |
| `CONNECT-001` | 5 | Native provider credential custody on a GitHub connection | `tests/github.mjs:41` | asserted |
| `CONNECT-001` | 5 | Owner review and installation at 1440 and 390 | `tests/helpers/collector-browser.mjs:36` | asserted |
| `CONNECT-001` | 5 | Failure and recovery at 1440 and 390 | `tests/helpers/collector-browser.mjs:49` | asserted |
| `CONNECT-001` | 5 | Revocation at 1440 and 390 | `tests/helpers/collector-browser.mjs:52` | asserted |
| `API-001` | 1 | A resource-push token is issued in Settings → API and shown once | `tests/api.mjs:106` | asserted |
| `API-001` | 2 | Pushing the same 50 resources again creates no duplicates | `tests/api.mjs:53` | asserted |
| `API-001` | 2 | The update timestamps are unchanged | `tests/api.mjs:54` | asserted |
| `API-001` | 3 | A full sync that omits one resource marks it removed | `tests/api.mjs:56` | asserted |
| `API-001` | 3 | The removed resource's history remains | `tests/api.mjs:58` | asserted |
| `API-001` | 4 | A custom mfa_enforced test fails exactly one resource | `tests/api.mjs:76` | asserted |
| `API-001` | 4 | Readiness shows the result labeled source-reported via the token | `tests/api.mjs:84` | asserted |
| `API-001` | 5 | Program state read through the API reconciles with the owner view | `tests/api.mjs:102` | asserted |
| `API-001` | 5 | Test results read through the API reconcile (paginated, no duplicates) | `tests/api.mjs:87` | asserted |
| `API-001` | 5 | Remediation state read through the API reconciles with the owner queue | `tests/api.mjs:92` | asserted |
| `API-001` | 6 | A token from another installation is refused | `tests/api.mjs:33` | asserted |
| `API-001` | 6 | A write outside the token's scopes is refused with nothing written | `tests/api.mjs:37` | asserted |
| `API-001` | 6 | A revoked token is refused with nothing written | `tests/api.mjs:40` | asserted |
| `API-001` | 7 | A schema-invalid payload is rejected per item | `tests/api.mjs:68` | asserted |
| `API-001` | 7 | Each rejected item carries its reasons | `tests/api.mjs:69` | asserted |
| `CLOUD-001` | 1 | AWS connects through an authorized assumed role | `tests/cloud.mjs:122` | asserted |
| `CLOUD-001` | 1 | Google Cloud and Azure connect after a real read listing projects and subscriptions | `tests/clouds.mjs:105` | asserted |
| `CLOUD-001` | 1 | AWS discovers its organization child accounts | `tests/cloud.mjs:133` | asserted |
| `CLOUD-001` | 1 | Google Cloud discovers its projects and Azure its subscriptions | `tests/clouds.mjs:105` | asserted |
| `CLOUD-001` | 1 | IAM/MFA tests run with a failing resource (AWS root MFA, Google Cloud public IAM) | `tests/cloud.mjs:136` | asserted |
| `CLOUD-001` | 1 | Public storage tests run with a failing resource (S3, GCS bucket, Azure storage) | `tests/clouds.mjs:116` | asserted |
| `CLOUD-001` | 1 | Encryption tests run (Azure storage HTTPS and Cloud SQL SSL fail; AWS EBS default encryption is read) | `tests/clouds.mjs:124` | asserted |
| `CLOUD-001` | 1 | Logging tests run with a failing resource (CloudTrail, Azure activity log) | `tests/cloud.mjs:140` | asserted |
| `CLOUD-001` | 1 | Backup tests run with a failing resource (RDS, Cloud SQL, Azure SQL retention) | `tests/cloud.mjs:142` | asserted |
| `CLOUD-001` | 1 | Network-configuration tests run with a failing resource (security group, firewall, NSG) | `tests/cloud.mjs:141` | asserted |
| `CLOUD-001` | 1 | The live provider account boundary (a real AWS organization, GCP organization and Azure tenant) — moved to the Field proof register (R-1) | none | moved |
| `CLOUD-001` | 2 | A setting changed at the provider passes on the re-test (AWS) | `tests/cloud.mjs:154` | asserted |
| `CLOUD-001` | 2 | A setting changed at the provider passes on the re-test (Google Cloud) | `tests/clouds.mjs:134` | asserted |
| `CLOUD-001` | 2 | A revoked read permission turns its resources unknown | `tests/cloud.mjs:157` | asserted |
| `CLOUD-001` | 3 | The failing resource is individually visible | `tests/cloud.mjs:139` | asserted |
| `CLOUD-001` | 3 | Missing coverage is visible as a named gap | `tests/cloud.mjs:160` | asserted |
| `CLOUD-001` | 3 | The original failing observation is kept beside the passing one | `tests/cloud.mjs:156` | asserted |
| `CLOUD-001` | 3 | Recovery is visible as a verified obligation | `tests/cloud.mjs:156` | asserted |
| `IDENTITY-001` | 1 | Okta, Google Workspace, Entra ID and JumpCloud tenants connect and read completely | `tests/identity.mjs:103` | asserted |
| `IDENTITY-001` | 1 | Employee, contractor, guest, service and suspended accounts are ingested as explicit populations | `tests/identity.mjs:105` | asserted |
| `IDENTITY-001` | 1 | Admin accounts are ingested with their privileged groups | `tests/identity.mjs:108` | asserted |
| `IDENTITY-001` | 1 | MFA is tested (and admin MFA) | `tests/identity.mjs:110` | asserted |
| `IDENTITY-001` | 1 | Inactive-user access is tested | `tests/identity.mjs:115` | asserted |
| `IDENTITY-001` | 1 | The live tenant boundary (real directory tenants) — moved to the Field proof register (R-2) | none | moved |
| `IDENTITY-001` | 2 | A disabled account reads as suspended on the next read | `tests/identity.mjs:142` | asserted |
| `IDENTITY-001` | 2 | A denied scope is recorded as unreadable coverage | `tests/identity.mjs:144` | asserted |
| `IDENTITY-001` | 3 | Duplicates are reconciled by human decisions | `tests/identity.mjs:131` | asserted |
| `IDENTITY-001` | 3 | A fresh source readback updates the result | `tests/identity.mjs:145` | asserted |
| `IDENTITY-001` | 3 | Incomplete coverage is shown and its results stay unknown | `tests/identity.mjs:148` | asserted |
| `VULN-002` | 1 | A 12-row CSV with its PDF is dry-run | `tests/vulns.mjs:59` | asserted |
| `VULN-002` | 1 | The dry run refuses the row with a missing severity | `tests/vulns.mjs:60` | asserted |
| `VULN-002` | 1 | Nothing is admitted until confirmed | `tests/vulns.mjs:64` | asserted |
| `VULN-002` | 2 | Confirming admits 11 findings | `tests/vulns.mjs:69` | asserted |
| `VULN-002` | 2 | Each is labeled manual with tester and report date | `tests/vulns.mjs:70` | asserted |
| `VULN-002` | 2 | Each has its SLA due date | `tests/vulns.mjs:74` | asserted |
| `VULN-002` | 3 | Marking a finding fixed without retest evidence leaves it awaiting verification | `tests/vulns.mjs:94` | asserted |
| `VULN-002` | 4 | An approved retest letter closes the finding | `tests/vulns.mjs:113` | asserted |
| `VULN-002` | 4 | The original finding is retained | `tests/vulns.mjs:115` | asserted |
| `VULN-002` | 4 | The original report is retained | `tests/vulns.mjs:119` | asserted |
| `VULN-002` | 5 | The vulnerability-remediation population lists every pentest finding | `tests/vulns.mjs:127` | asserted |
| `VULN-002` | 5 | Each population row carries its manual provenance | `tests/vulns.mjs:128` | asserted |
| `INVENTORY-001` | 1 | Duplicate person/device records are reconciled by explicit grouping | `tests/inventory.mjs:39` | asserted |
| `INVENTORY-001` | 1 | An unowned service is assigned an owner and retired/excluded with a reason | `tests/inventory.mjs:48` | asserted |
| `INVENTORY-001` | 2 | The export reconciles counts, canonical membership and history | `tests/inventory.mjs:58` | asserted |
| `INVENTORY-001` | 2 | The export includes every source row and the unmatched, excluded and retired records | `tests/inventory.mjs:59` | asserted |
| `INVENTORY-001` | 3 | A restart keeps decisions and history | `tests/inventory.mjs:64` | asserted |
| `INVENTORY-001` | 3 | An archive restore keeps decisions and original rows | `tests/inventory.mjs:66` | asserted |
| `INVENTORY-001` | 4 | Reconnecting an identical GitHub provider ID through another connection keeps distinct sources | `tests/github.mjs:159` | asserted |
| `INVENTORY-001` | 4 | Reconnecting keeps the original connection's test subjects | `tests/github.mjs:148` | asserted |
| `INVENTORY-001` | 4 | Removing AWS collection permission never shrinks known test subjects | `tests/cloud.mjs:169` | asserted |
| `INVENTORY-001` | 5 | Role policies are assigned through the same People identities | `tests/inventory.mjs:74` | asserted |
| `INVENTORY-001` | 5 | Role training is enrolled through the same People identities | `tests/inventory.mjs:77` | asserted |
| `INVENTORY-001` | 5 | An access-review population is frozen from the same identities | `tests/inventory.mjs:79` | asserted |
| `INVENTORY-001` | 5 | A departure is recorded | `tests/inventory.mjs:81` | asserted |
| `INVENTORY-001` | 5 | Future campaigns exclude the departed person | `tests/inventory.mjs:85` | asserted |
| `INVENTORY-001` | 5 | Prior history remains | `tests/inventory.mjs:87` | asserted |
| `INVENTORY-001` | 6 | The Inventory console shows these states at 1440 and 390 | `tests/inventory-browser.mjs:36` | asserted |
| `POPULATION-001` | 1 | A Justworks-style roster and an unconnected app's account list are uploaded as current manual populations | `tests/population.mjs:61` | asserted |
| `POPULATION-001` | 2 | One renamed column is mapped | `tests/population.mjs:39` | asserted |
| `POPULATION-001` | 2 | One ambiguous person match is resolved | `tests/population.mjs:57` | asserted |
| `POPULATION-001` | 2 | One row stays unmatched | `tests/population.mjs:58` | asserted |
| `POPULATION-001` | 3 | The People view shows both lists labeled manual with the upload time | `tests/population.mjs:67` | asserted |
| `POPULATION-001` | 3 | The Inventory view shows both lists labeled manual | `tests/population.mjs:59` | asserted |
| `POPULATION-001` | 4 | A test requiring source reads stays unknown for those records | `tests/population.mjs:56` | asserted |
| `POPULATION-001` | 5 | A revised list keeps the original exhibit | `tests/population.mjs:85` | asserted |
| `POPULATION-001` | 5 | The differences appear as joiners, leavers and removed accounts | `tests/population.mjs:83` | asserted |
| `POPULATION-001` | 6 | Past its refresh window the population shows stale | `tests/population.mjs:88` | asserted |
| `POPULATION-001` | 7 | A malformed file is refused with row-level reasons | `tests/population.mjs:35` | asserted |
| `POPULATION-001` | 7 | Nothing is admitted | `tests/population.mjs:36` | asserted |
| `TEST-001` | 1 | A test is enabled from a mapped control | `tests/api.mjs:81` | asserted |
| `TEST-001` | 1 | The test runs at least hourly — the cited test declares an hourly cadence but never observes repeated scheduled runs | none | none |
| `TEST-001` | 1 | A failing source setting fails its resource | `tests/api.mjs:76` | asserted |
| `TEST-001` | 1 | All resource results are inspected | `tests/api.mjs:76` | asserted |
| `TEST-001` | 2 | Scope is tuned with an expiring exception | `tests/api.mjs:141` | asserted |
| `TEST-001` | 2 | Collection is interrupted | none | none |
| `TEST-001` | 2 | Criteria are revised | `tests/api.mjs:159` | asserted |
| `TEST-001` | 3 | A later pass never erases the earlier failure | `tests/api.mjs:130` | asserted |
| `TEST-001` | 3 | An expired exception never erases the earlier failure | none | none |
| `TEST-001` | 3 | A revised denominator never erases the earlier failure | `tests/api.mjs:163` | asserted |
| `TEST-001` | 3 | No unobserved period is filled | none | none |
| `REMEDY-001` | 1 | A failed connected control opens a linked remediation obligation | `tests/work.mjs:130` | asserted |
| `REMEDY-001` | 1 | The Remediate action is followed from the test | none | none |
| `REMEDY-001` | 1 | An owner and due date are assigned | `tests/work.mjs:193` | asserted |
| `REMEDY-001` | 1 | A change is attached | none | none |
| `REMEDY-001` | 1 | Work is marked done (its ticket closed) before the source is fixed | `tests/work.mjs:169` | asserted |
| `REMEDY-001` | 1 | The obligation remains open after the failing re-test | `tests/work.mjs:175` | asserted |
| `REMEDY-001` | 2 | Fixing the source re-tests and verifies closure | `tests/work.mjs:227` | asserted |
| `REMEDY-001` | 3 | A regression reopens the obligation — asserted only in tests/api.mjs:129, which REMEDY-001 does not cite | none | none |
| `REMEDY-001` | 3 | Both observations are retained after the regression — asserted only in tests/api.mjs:130 | none | none |
| `REMEDY-002` | 1 | A 7-day SLA for high-severity identity failures sets each item's due date | `tests/report.mjs:45` | asserted |
| `REMEDY-002` | 1 | Two failing users get their own clocks | `tests/report.mjs:39` | asserted |
| `REMEDY-002` | 1 | The user fixed within the SLA shows resolved within SLA | `tests/report.mjs:78` | asserted |
| `REMEDY-002` | 1 | The other passes its deadline and shows SLA missed | `tests/report.mjs:78` | asserted |
| `REMEDY-002` | 1 | An escalation is sent once | `tests/report.mjs:67` | asserted |
| `REMEDY-002` | 2 | The board report exports per-item SLA status | `tests/report.mjs:94` | asserted |
| `REMEDY-002` | 2 | The exported rows reconcile with the report | `tests/report.mjs:113` | asserted |
| `REMEDY-002` | 3 | Closing the linked Jira ticket starts a re-test automatically within 15 minutes | `tests/work.mjs:173` | asserted |
| `REMEDY-002` | 3 | The re-test fails | `tests/work.mjs:176` | asserted |
| `REMEDY-002` | 3 | The obligation stays open | `tests/work.mjs:175` | asserted |
| `REMEDY-002` | 4 | Closing a GitHub Issues ticket and an Asana task each starts a re-test with no human action | `tests/work.mjs:172` | asserted |
| `REMEDY-002` | 5 | A source change event triggers the re-test | `tests/work.mjs:228` | asserted |
| `REMEDY-002` | 5 | That re-test verifies closure | `tests/work.mjs:227` | asserted |
| `REMEDY-002` | 6 | An expiring exception pauses the clock | `tests/report.mjs:156` | asserted |
| `REMEDY-002` | 6 | The clock resumes when the exception expires | `tests/report.mjs:173` | asserted |
| `WORK-001` | 1 | Each of the thirteen destinations connects an authorized project | `tests/trackers.mjs:58` | asserted |
| `WORK-001` | 1 | A ticket is created from one failed control with source links | `tests/trackers.mjs:74` | asserted |
| `WORK-001` | 1 | The tracker's assignee and status appear in Evidence within 15 minutes | `tests/trackers.mjs:95` | asserted |
| `WORK-001` | 1 | Assignee and status changed from Evidence reach the tracker | `tests/helpers/tracker-write-journey.mjs:36` | asserted |
| `WORK-001` | 1 | Exactly one ticket exists (a second create is refused) | `tests/trackers.mjs:71` | asserted |
| `WORK-001` | 1 | A second delivery of the same inbound event changes nothing | `tests/trackers.mjs:162` | asserted |
| `WORK-001` | 1 | The live tracker account boundary — moved to the Field proof register (R-4) | none | moved |
| `WORK-001` | 2 | Editing the same field on both sides shows a conflict | `tests/trackers.mjs:170` | asserted |
| `WORK-001` | 2 | The conflict shows both values and the time | `tests/trackers.mjs:171` | asserted |
| `WORK-001` | 3 | A revoked tracker grant is shown on the obligation | `tests/trackers.mjs:206` | asserted |
| `WORK-001` | 3 | A deleted remote ticket is shown on the obligation | `tests/trackers.mjs:202` | asserted |
| `WORK-001` | 4 | Closing the remote ticket while the test fails runs a re-test with no human action that fails and keeps the obligation open | `tests/trackers.mjs:197` | asserted |
| `WORK-001` | 4 | The re-test runs within 15 minutes of the close | `tests/trackers.mjs:198` | asserted |
| `WORK-001` | 5 | A tracker comment keeps its text, author, time, stable ID and source link | `tests/trackers.mjs:117` | asserted |
| `WORK-001` | 5 | Truncation is marked | `tests/trackers.mjs:121` | asserted |
| `WORK-001` | 5 | Need-to-know and privacy limits hold for comment history | `tests/trackers.mjs:125` | asserted |
| `WORK-001` | 5 | A source-read token cannot read the owner history | `tests/trackers.mjs:126` | asserted |
| `WORK-001` | 6 | The Basecamp secret-address callback is registered from Evidence | `tests/helpers/basecamp-webhook-journey.mjs:12` | asserted |
| `WORK-001` | 6 | A to-do event and its replay are admitted once | `tests/helpers/basecamp-webhook-journey.mjs:29` | asserted |
| `WORK-001` | 6 | A comment event is admitted | `tests/helpers/basecamp-webhook-journey.mjs:36` | asserted |
| `WORK-001` | 6 | A wrong secret is refused | `tests/helpers/basecamp-webhook-journey.mjs:20` | asserted |
| `WORK-001` | 6 | A wrong project is refused | `tests/helpers/basecamp-webhook-journey.mjs:21` | asserted |
| `WORK-001` | 6 | A wrong account is refused | `tests/helpers/basecamp-webhook-journey.mjs:22` | asserted |
| `WORK-001` | 7 | Advancing the scheduler one hour checks the registration | `tests/helpers/basecamp-webhook-journey.mjs:47` | asserted |
| `WORK-001` | 7 | A deactivated registration removes callback authority | `tests/helpers/basecamp-webhook-journey.mjs:54` | asserted |
| `WORK-001` | 7 | The owner sees the problem | `tests/helpers/basecamp-webhook-journey.mjs:53` | asserted |
| `WORK-001` | 7 | Polling continues | `tests/helpers/basecamp-webhook-journey.mjs:57` | asserted |
| `WORK-001` | 8 | After restore no callback secret returns | `tests/trackers.mjs:302` | asserted |
| `WORK-001` | 8 | After restore no registration authority returns | `tests/trackers.mjs:308` | asserted |
| `WORK-003` | 1 | The signed-in owner writes a mapped native assignee and status, and read-back confirms the requested identities | `tests/helpers/tracker-write-journey.mjs:36` | asserted |
| `WORK-003` | 1 | Editing Evidence's accountable owner or compliance state does not stand in for the write | none | none |
| `WORK-003` | 2 | A field changed at the tracker after the displayed snapshot is not written | `tests/helpers/tracker-write-journey.mjs:73` | asserted |
| `WORK-003` | 2 | Sync history keeps the tracker value | `tests/helpers/tracker-write-journey.mjs:74` | asserted |
| `WORK-003` | 2 | Sync history keeps the requested value | `tests/helpers/tracker-write-journey.mjs:75` | asserted |
| `WORK-003` | 2 | Sync history keeps the expected snapshot | none | none |
| `WORK-003` | 2 | Sync history keeps the actor's reason and the UTC conflict time | `tests/helpers/tracker-write-journey.mjs:79` | asserted |
| `WORK-003` | 3 | An unknown native identity is refused before any provider write | `tests/helpers/tracker-write-journey.mjs:31` | asserted |
| `WORK-003` | 4 | A lost read-back stays uncertain | `tests/helpers/tracker-write-journey.mjs:50` | asserted |
| `WORK-003` | 4 | An uncertain write is never reported as success | `tests/helpers/tracker-write-journey.mjs:51` | asserted |
| `WORK-003` | 5 | An unsigned request is refused at the write door | `tests/helpers/tracker-write-journey.mjs:25` | asserted |
| `WORK-003` | 5 | An API (agent) token is refused at the write door | `tests/helpers/tracker-write-journey.mjs:25` | asserted |
| `WORK-002` | 1 | A per-item test failing on two resources creates two tickets | `tests/work.mjs:250` | asserted |
| `WORK-002` | 1 | Each ticket carries its own due date | `tests/work.mjs:259` | asserted |
| `WORK-002` | 1 | The live tracker account boundary — moved to the Field proof register (R-4) | none | moved |
| `WORK-002` | 2 | Within 15 minutes the test page shows the tracker's new assignee | `tests/work.mjs:265` | asserted |
| `WORK-002` | 2 | The remediation queue shows the new assignee | `tests/work.mjs:267` | asserted |
| `WORK-002` | 2 | The remediation queue shows the tracker status | `tests/work.mjs:268` | asserted |
| `WORK-002` | 3 | Closing the ticket starts a re-test within 15 minutes with no human action, and it fails | `tests/work.mjs:276` | asserted |
| `WORK-002` | 3 | That item stays open | `tests/work.mjs:273` | asserted |
| `WORK-002` | 3 | Both items' SLA clocks keep running unchanged | `tests/work.mjs:278` | asserted |
| `WORK-002` | 3 | The other item is not re-tested | `tests/work.mjs:277` | asserted |
| `WORK-002` | 4 | Fixing the second resource and closing its ticket closes only that item, as verified | `tests/work.mjs:293` | asserted |
| `WORK-002` | 4 | The first item stays open | `tests/work.mjs:294` | asserted |
| `WORK-002` | 5 | A whole-test ticket is created for three failing items | `tests/work.mjs:304` | asserted |
| `WORK-002` | 5 | It lists all three with their deadlines | `tests/work.mjs:306` | asserted |
| `WORK-002` | 6 | Closing it re-tests every listed item | `tests/work.mjs:318` | asserted |
| `WORK-002` | 6 | Only the fixed item closes | `tests/work.mjs:324` | asserted |
| `WORK-002` | 6 | The remote ticket reopens | `tests/work.mjs:325` | asserted |
| `WORK-002` | 6 | The reopening comment names the other items | `tests/work.mjs:327` | asserted |
| `FOLLOWUP-001` | 1 | Slack and Microsoft Teams are configured and reach the people who chose them | `tests/followup.mjs:59` | asserted |
| `FOLLOWUP-001` | 1 | Email reaches the person who chose it (the default mail provider) | `tests/followup.mjs:61` | asserted |
| `FOLLOWUP-001` | 1 | SendGrid is configured as the email provider | none | none |
| `FOLLOWUP-001` | 1 | A due obligation escalates across the weekend, the DST change and a holiday with the browser closed | `tests/followup.mjs:71` | asserted |
| `FOLLOWUP-001` | 1 | After a worker restart nothing is resent (the harness clock restarts workerd) | `tests/followup.mjs:74` | asserted |
| `FOLLOWUP-001` | 1 | The live workspace and production mail boundary — moved to the Field proof register (R-5) | none | moved |
| `FOLLOWUP-001` | 2 | A network-edge timeout leaves the delivery uncertain | `tests/followup.mjs:88` | asserted |
| `FOLLOWUP-001` | 2 | The uncertain delivery is never resent | `tests/followup.mjs:89` | asserted |
| `FOLLOWUP-001` | 2 | Reconnecting authorization restores sends | `tests/followup.mjs:98` | asserted |
| `FOLLOWUP-001` | 3 | Pausing the obligation stops later reminders while history remains | `tests/followup.mjs:77` | asserted |
| `FOLLOWUP-001` | 4 | Each control owner's weekly digest holds only their own items | `tests/followup.mjs:109` | asserted |
| `FOLLOWUP-001` | 4 | The digest reconciles to the remediation queue | `tests/followup.mjs:112` | asserted |
| `FOLLOWUP-001` | 4 | A control owner with nothing open receives no digest | `tests/followup.mjs:107` | asserted |
| `RISK-001` | 1 | A risk is created from a failing control and linked to its control, test, vendor and incident | `tests/risk.mjs:117` | asserted |
| `RISK-001` | 1 | The risk is scored (assessments carry their score and level) | `tests/risk.mjs:166` | asserted |
| `RISK-001` | 1 | Mitigation is assigned as a treatment | `tests/risk.mjs:112` | asserted |
| `RISK-001` | 1 | A time-bounded residual-risk acceptance is approved | `tests/risk.mjs:115` | asserted |
| `RISK-001` | 1 | The register is exported | `tests/risk.mjs:104` | asserted |
| `RISK-001` | 2 | An expired acceptance escalates once | `tests/risk.mjs:123` | asserted |
| `RISK-001` | 2 | The escalation is sent once to the owner | `tests/risk.mjs:124` | asserted |
| `RISK-001` | 2 | A passing re-test updates treatment evidence | `tests/risk.mjs:129` | asserted |
| `RISK-001` | 2 | The original assessment is not rewritten | `tests/risk.mjs:130` | asserted |
| `RISK-002` | 1 | Five library risks are each linked to their suggested controls | `tests/risk.mjs:45` | asserted |
| `RISK-002` | 1 | Each is linked to matching in-scope assets | `tests/risk.mjs:46` | asserted |
| `RISK-002` | 2 | The dry run refuses one invalid row with a reason | `tests/risk.mjs:63` | asserted |
| `RISK-002` | 2 | 29 risks are admitted labeled imported | `tests/risk.mjs:70` | asserted |
| `RISK-002` | 3 | Earlier assessments keep their original scale, labels and score after the scale change | `tests/risk.mjs:95` | asserted |
| `RISK-002` | 3 | Both method revisions keep their own scale | `tests/risk.mjs:96` | asserted |
| `RISK-002` | 4 | A reassessment keeps both assessments with their method revisions | `tests/risk.mjs:93` | asserted |
| `RISK-002` | 5 | A HIPAA program adds its ePHI/HIPAA scenarios from the library | `tests/risk.mjs:52` | asserted |
| `RISK-002` | 6 | The register exports with the method revision per assessment | `tests/risk.mjs:104` | asserted |
| `VENDOR-001` | 1 | A US SaaS supplier is onboarded with its data access and tier | `tests/helpers/vendor-journey.mjs:17` | asserted |
| `VENDOR-001` | 1 | A SOC 2 report and a BAA are requested | `tests/helpers/vendor-journey.mjs:80` | asserted |
| `VENDOR-001` | 2 | The CAIQ v4 template type is sent after importing its licensed workbook | `tests/helpers/vendor-journey.mjs:43` | asserted |
| `VENDOR-001` | 2 | The supplier's per-question response is collected | `tests/helpers/vendor-journey.mjs:108` | asserted |
| `VENDOR-001` | 2 | A finding is recorded | `tests/helpers/vendor-journey.mjs:117` | asserted |
| `VENDOR-001` | 3 | The vendor is approved with an expiring condition | `tests/helpers/vendor-journey.mjs:129` | asserted |
| `VENDOR-001` | 3 | At renewal the reassessment is overdue and reminded once | `tests/helpers/vendor-journey.mjs:174` | asserted |
| `VENDOR-001` | 3 | The original documents are unchanged | `tests/helpers/vendor-journey.mjs:184` | asserted |
| `VENDOR-001` | 4 | A supplier link cannot read another vendor's request | `tests/helpers/vendor-journey.mjs:153` | asserted |
| `VENDOR-001` | 4 | An expired link cannot read or upload | `tests/helpers/vendor-journey.mjs:161` | asserted |
| `VENDOR-001` | 4 | The other vendor's documents are unchanged | `tests/helpers/vendor-journey.mjs:164` | asserted |
| `VENDOR-001` | 5 | CAIQ v4.0.x and SIG Lite workbooks import with a licence confirmation | `tests/helpers/vendor-journey.mjs:40` | asserted |
| `VENDOR-001` | 5 | Each is refused without a confirmation, from a file named without SIG | `tests/helpers/vendor-journey.mjs:37` | asserted |
| `VENDOR-001` | 6 | A SIG Core-sized workbook (1,200 questions) is admitted | `tests/helpers/vendor-journey.mjs:40` | asserted |
| `VENDOR-001` | 6 | Each imported template is sent | `tests/helpers/vendor-journey.mjs:43` | asserted |
| `VENDOR-001` | 7 | A supplier's completed CAIQ arrives as per-question answers keyed by CAIQ id | `tests/helpers/vendor-journey.mjs:63` | asserted |
| `POLICY-001` | 1 | A template is tailored to connected business facts | `tests/policy.mjs:45` | asserted |
| `POLICY-001` | 1 | Only the exact reviewed revision can be approved | `tests/policy.mjs:61` | asserted |
| `POLICY-001` | 1 | A changed draft is rejected and cannot publish | `tests/policy.mjs:60` | asserted |
| `POLICY-001` | 1 | The approved revision publishes | `tests/policy.mjs:65` | asserted |
| `POLICY-001` | 1 | The published policy satisfies its mapped requirements in two frameworks (SOC 2 and ISO 27001) | `tests/policy.mjs:69` | asserted |
| `POLICY-001` | 2 | A replacement publishes as a material revision and reassigns acknowledgments | `tests/policy.mjs:108` | asserted |
| `POLICY-001` | 2 | The new required acknowledgment is visible beside the superseded one | `tests/policy.mjs:110` | asserted |
| `POLICY-001` | 2 | The original approval and attestations remain | `tests/policy.mjs:116` | asserted |
| `POLICY-001` | 3 | A fresh SOC 2 and ISO 27001 program lists every requirement lacking a published policy | `tests/policy.mjs:40` | asserted |
| `POLICY-001` | 4 | After the shipped templates are approved and published, it lists none | `tests/policy.mjs:69` | asserted |
| `POLICY-001` | 5 | A build-time check fails if a requirement calling for a policy has no shipped template — the check is `scripts/library-check.mjs` line 70, which this clause does not cite | none | none |
| `POLICY-001` | 6 | A policy past its review deadline fails its linked policy test | `tests/policy.mjs:71` | asserted |
| `ATTEST-001` | 1 | A policy revision is assigned to an employee and a contractor | `tests/policy.mjs:78` | asserted |
| `ATTEST-001` | 1 | Each signs in to their own tasks | `tests/policy.mjs:82` | asserted |
| `ATTEST-001` | 1 | One acknowledges and the other is overdue | `tests/policy.mjs:102` | asserted |
| `ATTEST-001` | 2 | A material revision reassigns | `tests/policy.mjs:110` | asserted |
| `ATTEST-001` | 2 | Reminders go to the overdue person | `tests/policy.mjs:100` | asserted |
| `ATTEST-001` | 3 | A terminated person is denied access | `tests/policy.mjs:113` | asserted |
| `ATTEST-001` | 3 | The audit export retains the time, version and identity evidence | `tests/policy.mjs:118` | asserted |
| `LIFECYCLE-002` | 1 | One person owns two controls (one CC6.2's), a policy, a risk and an open obligation, and their departure is recorded | `tests/handover.mjs:68` | asserted |
| `LIFECYCLE-002` | 2 | The same day each item shows owner left with the departure date | `tests/handover.mjs:69` | asserted |
| `LIFECYCLE-002` | 2 | Readiness counts the controls as unowned | `tests/handover.mjs:72` | asserted |
| `LIFECYCLE-002` | 2 | The compliance owner is asked to hand them over | `tests/handover.mjs:74` | asserted |
| `LIFECYCLE-002` | 3 | Reassigning CC6.2's control notifies Priya | `tests/handover.mjs:81` | asserted |
| `LIFECYCLE-002` | 3 | The control shows Priya as owner | `tests/handover.mjs:83` | asserted |
| `LIFECYCLE-002` | 3 | The departed owner and the reason stay in its history | `tests/handover.mjs:85` | asserted |
| `LIFECYCLE-002` | 4 | A bulk handover moves the rest to one successor, item by item | `tests/handover.mjs:97` | asserted |
| `LIFECYCLE-002` | 5 | An item past the handover window escalates | `tests/handover.mjs:125` | asserted |
| `LIFECYCLE-002` | 6 | The departed person's earlier decisions still name them | `tests/handover.mjs:110` | asserted |
| `ACCESS-001` | 1 | A quarterly review starts with a frozen population | `tests/access.mjs:61` | asserted |
| `ACCESS-001` | 1 | A resource owner decides employee access with a reason | `tests/access.mjs:73` | asserted |
| `ACCESS-001` | 1 | A resource owner decides guest access with a reason | `tests/access.mjs:74` | asserted |
| `ACCESS-001` | 1 | A resource owner decides privileged service access with a reason | `tests/access.mjs:75` | asserted |
| `ACCESS-001` | 1 | One decision is left overdue | `tests/access.mjs:91` | asserted |
| `ACCESS-001` | 2 | Revocation is requested | `tests/access.mjs:86` | asserted |
| `ACCESS-001` | 2 | With the source account still active the revocation stays unresolved | `tests/access.mjs:91` | asserted |
| `ACCESS-001` | 3 | Revoking in the source and re-reading verifies the revocation | `tests/access.mjs:98` | asserted |
| `ACCESS-001` | 3 | The export carries the population and every decision | `tests/access.mjs:127` | asserted |
| `ACCESS-001` | 3 | The export carries the revocation and period evidence | `tests/access.mjs:130` | asserted |
| `ACCESS-001` | 4 | Revoke is decided on a departed person's account in an uploaded app list | `tests/access.mjs:78` | asserted |
| `ACCESS-001` | 4 | The re-uploaded list without the account evidences the revocation | `tests/access.mjs:99` | asserted |
| `ACCESS-001` | 4 | Both lists are retained | `tests/access.mjs:100` | asserted |
| `AUDIT-001` | 1 | An auditor is invited to one engagement and signs in | `tests/helpers/engagement-journey.mjs:22` | asserted |
| `AUDIT-001` | 1 | A request list is imported atomically | `tests/helpers/engagement-journey.mjs:29` | asserted |
| `AUDIT-001` | 1 | Each request is assigned to an owner | `tests/helpers/engagement-journey.mjs:46` | asserted |
| `AUDIT-001` | 1 | Comments are recorded | `tests/helpers/engagement-journey.mjs:59` | asserted |
| `AUDIT-001` | 1 | A period-specific exhibit is submitted | `tests/helpers/engagement-journey.mjs:57` | asserted |
| `AUDIT-001` | 2 | The auditor rejects, asks for more and accepts the next submission | `tests/helpers/engagement-journey.mjs:68` | asserted |
| `AUDIT-001` | 3 | The pack exports | `tests/helpers/engagement-journey.mjs:69` | asserted |
| `AUDIT-001` | 3 | Another engagement stays inaccessible | `tests/helpers/engagement-journey.mjs:23` | asserted |
| `AUDIT-001` | 3 | A revoked auditor is refused | `tests/helpers/engagement-journey.mjs:79` | asserted |
| `AUDIT-001` | 3 | The original submission and decisions remain available to the owner | `tests/helpers/engagement-journey.mjs:80` | asserted |
| `AUDIT-001` | 4 | A request linked to a tested control opens in-period observations with source connector, account and observed time | `tests/helpers/engagement-journey.mjs:38` | asserted |
| `AUDIT-001` | 4 | Submitted receipts show their source, server receipt time and SHA-256 | `tests/helpers/engagement-journey.mjs:70` | asserted |
| `AUDIT-001` | 5 | An observation outside the period is not shown | `tests/helpers/engagement-journey.mjs:40` | asserted |
| `AUDIT-001` | 5 | A receipt outside the period is not shown | `tests/helpers/engagement-journey.mjs:75` | asserted |
| `AUDIT-003` | 1 | A Type II engagement is created at a Restricted detail level hiding emails | `tests/helpers/audit-sharing-journey.mjs:293` | asserted |
| `AUDIT-003` | 1 | Three automated tests and one policy are shared into it | `tests/helpers/audit-sharing-journey.mjs:252` | asserted |
| `AUDIT-003` | 1 | One shared test has a mid-period failure | `tests/helpers/audit-sharing-journey.mjs:119` | asserted |
| `AUDIT-003` | 1 | One shared test has a stale interval | `tests/helpers/audit-sharing-journey.mjs:114` | asserted |
| `AUDIT-003` | 1 | One test has an item remediated before the period began | `tests/helpers/audit-remediation-journey.mjs:72` | asserted |
| `AUDIT-003` | 2 | Only in-period observations appear | `tests/helpers/audit-sharing-journey.mjs:118` | asserted |
| `AUDIT-003` | 2 | Only in-scope resources and their in-scope observations appear | `tests/helpers/audit-sharing-journey.mjs:101` | asserted |
| `AUDIT-003` | 2 | SLA status appears per item | `tests/helpers/audit-remediation-journey.mjs:94` | asserted |
| `AUDIT-003` | 2 | Emails are replaced by stable pseudonyms | `tests/helpers/audit-sharing-journey.mjs:263` | asserted |
| `AUDIT-003` | 3 | The pre-period item appears only in its remediated-before-period list | `tests/helpers/audit-remediation-journey.mjs:71` | asserted |
| `AUDIT-003` | 4 | A flagged test's result and observations are unchanged | `tests/helpers/audit-sharing-journey.mjs:268` | asserted |
| `AUDIT-003` | 4 | Readiness is unchanged by the decisions | `tests/helpers/audit-sharing-journey.mjs:269` | asserted |
| `AUDIT-003` | 4 | The decisions appear in the exported pack at its Restricted detail level | `tests/helpers/audit-sharing-journey.mjs:272` | asserted |
| `AUDIT-003` | 5 | The owner's preview matches the auditor's view field for field | `tests/helpers/audit-sharing-journey.mjs:264` | asserted |
| `AUDIT-003` | 6 | A request for an unshared test is refused at the HTTP door | `tests/helpers/audit-sharing-journey.mjs:110` | asserted |
| `AUDIT-003` | 6 | A request for an out-of-period observation is refused at the HTTP door | `tests/helpers/audit-sharing-journey.mjs:125` | asserted |
| `AUDIT-003` | 7 | After unsharing the policy the auditor can no longer open it | `tests/helpers/audit-sharing-journey.mjs:236` | asserted |
| `AUDIT-003` | 7 | The unsharing is recorded | `tests/helpers/audit-sharing-journey.mjs:248` | asserted |
| `TRUST-003` | 1 | A signed-out visitor subscribes and is sent a confirmation | `tests/helpers/trust-journey.mjs:44` | asserted |
| `TRUST-003` | 1 | The double opt-in confirms | `tests/helpers/trust-journey.mjs:218` | asserted |
| `TRUST-003` | 2 | The owner adds a subscriber by email with a reason | `tests/helpers/trust-journey.mjs:219` | asserted |
| `TRUST-003` | 2 | A third subscriber subscribes and then unsubscribes | `tests/helpers/trust-journey.mjs:220` | asserted |
| `TRUST-003` | 3 | A subprocessor with an effective date 30 days out is pending with its notice draft | `tests/helpers/trust-journey.mjs:134` | asserted |
| `TRUST-003` | 3 | Publishing without approval is refused and sends nothing | `tests/helpers/trust-journey.mjs:108` | asserted |
| `TRUST-003` | 4 | Approving sends the notice and records delivery per subscriber | `tests/helpers/trust-journey.mjs:112` | asserted |
| `TRUST-003` | 4 | A bounce at the network edge is recorded | `tests/helpers/trust-journey.mjs:130` | asserted |
| `TRUST-003` | 5 | The unsubscribed address receives nothing | `tests/helpers/trust-journey.mjs:112` | asserted |
| `TRUST-003` | 6 | The public list shows the pending subprocessor with its effective date | `tests/helpers/trust-journey.mjs:134` | asserted |
| `TRUST-003` | 6 | After that date it shows as active | `tests/helpers/trust-journey.mjs:228` | asserted |
| `TRUST-003` | 7 | A signed-out browser sees only the public update, not the customer-only one | `tests/helpers/trust-journey.mjs:180` | asserted |
| `TRUST-003` | 8 | The notice record exports with per-subscriber outcomes | `tests/helpers/trust-journey.mjs:138` | asserted |
| `TRUST-005` | 1 | Owner publication authorization starts disabled | `tests/helpers/trust-journey.mjs:62` | asserted |
| `TRUST-005` | 1 | A customer-facing send is refused while disabled | `tests/helpers/trust-journey.mjs:174` | asserted |
| `TRUST-005` | 2 | A notification carries the exact approved category content | `tests/helpers/trust-journey.mjs:117` | asserted |
| `TRUST-005` | 2 | It carries the postal address | `tests/helpers/trust-journey.mjs:45` | asserted |
| `TRUST-005` | 2 | It carries one-click withdrawal | `tests/helpers/trust-journey.mjs:118` | asserted |
| `TRUST-005` | 2 | It reaches only the named-record recipients in scope | `tests/helpers/trust-journey.mjs:178` | asserted |
| `TRUST-005` | 3 | Unconfirmed and withdrawn addresses are excluded | `tests/helpers/trust-journey.mjs:112` | asserted |
| `TRUST-005` | 3 | Expired and revoked recipients are excluded | `tests/helpers/trust-journey.mjs:178` | asserted |
| `TRUST-005` | 3 | Out-of-record recipients are excluded | `tests/helpers/trust-journey.mjs:184` | asserted |
| `TRUST-005` | 4 | Pending delivery is retained | `tests/helpers/trust-journey.mjs:113` | asserted |
| `TRUST-005` | 4 | Delivered and bounced outcomes are retained | `tests/helpers/trust-journey.mjs:130` | asserted |
| `TRUST-005` | 4 | Failed and uncertain outcomes are retained | `tests/helpers/trust-journey.mjs:245` | asserted |
| `TRUST-005` | 4 | Signed events are admitted and replays deduplicated | `tests/helpers/trust-journey.mjs:125` | asserted |
| `TRUST-005` | 4 | Forged events are refused | `tests/helpers/trust-journey.mjs:127` | asserted |
| `TRUST-005` | 4 | A restart sends nothing twice | `tests/helpers/trust-journey.mjs:140` | asserted |
| `TRUST-005` | 5 | A GET does not establish consent | `tests/helpers/trust-journey.mjs:86` | asserted |
| `TRUST-005` | 5 | A duplicate request does not repeat a confirmation | `tests/helpers/trust-journey.mjs:79` | asserted |
| `TRUST-005` | 5 | A reused link does not change consent | `tests/helpers/trust-journey.mjs:90` | asserted |
| `TRUST-005` | 5 | A stale (expired) request never establishes consent | `tests/helpers/trust-journey.mjs:225` | asserted |
| `TRUST-005` | 5 | A withdrawal cannot be undone by an old confirmation | `tests/helpers/trust-journey.mjs:103` | asserted |
| `TRUST-005` | 5 | Disabled owner authorization sends nothing and establishes no consent | `tests/helpers/trust-journey.mjs:83` | asserted |
| `TRUST-005` | 6 | Consent history survives custody restore | `tests/helpers/trust-journey.mjs:265` | asserted |
| `TRUST-005` | 6 | Restored publication stays inactive until reauthorized | `tests/helpers/trust-journey.mjs:272` | asserted |
| `TRUST-005` | 7 | The request reaches the provider edge from the browser at 1440 and 390 | `tests/helpers/engagement-browser.mjs:66` | asserted |
| `TRUST-005` | 7 | Confirmation and withdrawal end states fit at 1440 and 390 | `tests/helpers/engagement-browser.mjs:74` | asserted |
| `TRUST-005` | 7 | Public and customer feeds and owner notice evidence open at 1440 and 390 | `tests/helpers/engagement-browser.mjs:25` | asserted |
| `MIGRATE-001` | 1 | A Vanta export is previewed | `tests/helpers/migrate-journey.mjs:41` | asserted |
| `MIGRATE-001` | 1 | A Secureframe export is previewed | `tests/helpers/migrate-journey.mjs:114` | asserted |
| `MIGRATE-001` | 1 | A Drata package is previewed | `tests/import.mjs:34` | asserted |
| `MIGRATE-001` | 1 | A duplicate identity must be resolved by the owner before mapping | `tests/helpers/migrate-journey.mjs:51` | asserted |
| `MIGRATE-001` | 1 | The resolved identity is applied | `tests/helpers/migrate-journey.mjs:67` | asserted |
| `MIGRATE-001` | 1 | The import is admitted | `tests/helpers/migrate-journey.mjs:59` | asserted |
| `MIGRATE-001` | 1 | The import is exported | `tests/helpers/migrate-journey.mjs:80` | asserted |
| `MIGRATE-001` | 1 | The import is undone | `tests/helpers/migrate-journey.mjs:100` | asserted |
| `MIGRATE-001` | 1 | The real customer tenant export boundary — moved to the Field proof register (R-6) | none | moved |
| `MIGRATE-001` | 2 | Frameworks, controls and mappings reconcile as source, admitted, unsupported and refused | `tests/helpers/migrate-journey.mjs:64` | asserted |
| `MIGRATE-001` | 2 | Test history reconciles | `tests/helpers/migrate-journey.mjs:64` | asserted |
| `MIGRATE-001` | 2 | Policies reconcile with approval history and attestations | `tests/helpers/migrate-journey.mjs:70` | asserted |
| `MIGRATE-001` | 2 | People reconcile | `tests/helpers/migrate-journey.mjs:64` | asserted |
| `MIGRATE-001` | 2 | Vendors reconcile | `tests/helpers/migrate-journey.mjs:64` | asserted |
| `MIGRATE-001` | 2 | Risks reconcile | `tests/helpers/migrate-journey.mjs:64` | asserted |
| `MIGRATE-001` | 2 | Access-review decisions reconcile (Secureframe, non-empty) | `tests/helpers/migrate-journey.mjs:121` | asserted |
| `MIGRATE-001` | 2 | Audit requests reconcile (Vanta, non-empty) | `tests/helpers/migrate-journey.mjs:64` | asserted |
| `MIGRATE-001` | 2 | Trust-center and answer-library content reconciles (Secureframe, non-empty) | `tests/helpers/migrate-journey.mjs:121` | asserted |
| `MIGRATE-001` | 2 | Original exhibits reconcile by bytes and digest | `tests/helpers/migrate-journey.mjs:74` | asserted |
| `MIGRATE-001` | 3 | A reconnected actual source gives fresh source-observed observations | `tests/helpers/migrate-journey.mjs:88` | asserted |
| `MIGRATE-001` | 3 | Imported history stays distinct from them | `tests/helpers/migrate-journey.mjs:92` | asserted |
| `MIGRATE-001` | 4 | A record type the incumbent does not export is named with its authorized API or manual route | `tests/helpers/migrate-journey.mjs:116` | asserted |
| `PORTABLE-001` | 1 | A populated program with every current record class, over 20,000 resource rows and over 64 MiB of originals exports | `tests/helpers/portable-journey.mjs:39` | asserted |
| `PORTABLE-001` | 1 | The local archive command exports and restores offline | `tests/helpers/portable-journey.mjs:86` | asserted |
| `PORTABLE-001` | 1 | The restore lands in an empty installation with a different owner | `tests/helpers/portable-journey.mjs:47` | asserted |
| `PORTABLE-001` | 2 | A multipart upload resumes across a Worker restart (the harness clock restarts workerd) | `tests/helpers/portable-journey.mjs:52` | asserted |
| `PORTABLE-001` | 2 | A final-digest failure admits no business records or originals | `tests/helpers/portable-journey.mjs:51` | asserted |
| `PORTABLE-001` | 3 | Table and blob inventory reconciles | `tests/helpers/portable-journey.mjs:55` | asserted |
| `PORTABLE-001` | 3 | Original history reconciles row for row | `tests/helpers/portable-journey.mjs:56` | asserted |
| `PORTABLE-001` | 3 | Unavailable bytes stay unavailable | `tests/archive.mjs:114` | asserted |
| `PORTABLE-001` | 3 | Erasure fences are enforced | `tests/helpers/portable-journey.mjs:44` | asserted |
| `PORTABLE-001` | 4 | No message, source mutation or external grant replays after restore | `tests/helpers/portable-journey.mjs:72` | asserted |
| `PORTABLE-001` | 4 | One connector is reauthorized explicitly and others stay inert | `tests/helpers/portable-journey.mjs:77` | asserted |
| `PORTABLE-001` | 5 | An unknown table is refused | `tests/helpers/portable-journey.mjs:36` | asserted |
| `PORTABLE-001` | 5 | A pre-erasure archive without the required later journal is refused | `tests/helpers/portable-journey.mjs:45` | asserted |
| `LOG-001` | 1 | Import and undo are audited with their outcomes | `tests/import.mjs:92` | asserted |
| `LOG-001` | 1 | A folder read is audited | `tests/review.mjs:161` | asserted |
| `LOG-001` | 1 | A folder refusal is audited | `tests/review.mjs:160` | asserted |
| `LOG-001` | 1 | An approval is audited with its exact snapshot | `tests/agent.mjs:86` | asserted |
| `LOG-001` | 1 | A source change (a tracker write) is audited | `tests/work.mjs:146` | asserted |
| `LOG-001` | 1 | A failed send is audited | `tests/followup.mjs:128` | asserted |
| `LOG-001` | 1 | An erasure is audited — no cited journey performs an erasure | none | none |
| `LOG-001` | 2 | The audit is inspected and exported (CSV and JSON) | `tests/import.mjs:96` | asserted |
| `LOG-001` | 2 | Each export is itself recorded | `tests/import.mjs:99` | asserted |
| `LOG-001` | 2 | A restart keeps every entry (the harness clock restarts workerd) | `tests/import.mjs:113` | asserted |
| `LOG-001` | 2 | A restore keeps every entry | `tests/import.mjs:121` | asserted |
| `LOG-001` | 3 | Every action and its outcome stays attributable without secrets | `tests/import.mjs:100` | asserted |
| `LOG-001` | 3 | An erased actor is anonymous — person erasure is not built; ERASE-001 carries it | none | none |
| `LOG-001` | 3 | An interrupted send stays uncertain until the owner resolves it | `tests/followup.mjs:137` | asserted |
| `OPS-001` | 1 | The documented setup, dev and build commands run — the cited tests start the runtime harness; the documented commands are not exercised in a cited file | none | none |
| `OPS-001` | 1 | An omitted required setting is named, without its value, and refuses before effects | `tests/ops.mjs:36` | asserted |
| `OPS-001` | 1 | A restart during a collection preserves its claim and reconciles without an invented observation | `tests/ops.mjs:187` | asserted |
| `OPS-001` | 1 | A restart during a notification never resends it | `tests/ops.mjs:186` | asserted |
| `OPS-001` | 1 | An interrupted storage write stays failed and visible | `tests/ops.mjs:87` | asserted |
| `OPS-001` | 2 | Health shows queue, storage, connector last success and backup state | `tests/ops.mjs:194` | asserted |
| `OPS-001` | 2 | Every scheduled step keeps a durable outcome across a restart | `tests/ops.mjs:67` | asserted |
| `OPS-001` | 2 | A complete backup restores with its history and no replay | `tests/ops.mjs:213` | asserted |
| `OPS-001` | 2 | An additive migration keeps earlier evidence unchanged | `tests/archive.mjs:40` | asserted |
| `OPS-001` | 3 | A documented size bound refuses explicitly | `tests/ops.mjs:200` | asserted |
| `OPS-001` | 3 | The USD cost and configuration explanation is shown | `tests/ops.mjs:198` | asserted |
| `PUBLIC-001` | 1 | The built run site's homepage opens the run instructions and docs | `tests/site.mjs:42` | asserted |
| `PUBLIC-001` | 1 | The landing works without JavaScript | `tests/site.mjs:47` | asserted |
| `PUBLIC-001` | 1 | The installed Lobby opens before setup | `tests/browser.mjs:101` | asserted |
| `PUBLIC-001` | 1 | After setup the printed link opens the owner desk | `tests/browser.mjs:113` | asserted |
| `PUBLIC-001` | 2 | Existing browser journeys inspect the approved owner flows at 1440 and 390 | `tests/browser.mjs:113` | asserted |
| `PUBLIC-001` | 2 | Existing browser journeys inspect the approved reviewer flows at 1440 and 390 — the reviewer journeys are in tests/review-browser.mjs, which PUBLIC-001 does not cite | none | none |
| `OPEN-001` | 1 | The repository's LICENSE is the MIT license | `LICENSE:1` | asserted |
| `OPEN-001` | 1 | The package metadata declares MIT | `package.json:5` | asserted |
| `OPEN-001` | 2 | Every product area opens with no payment, upgrade or licence prompt | `tests/open.mjs:25` | asserted |
| `OPEN-001` | 2 | Four core programs and 250 people are reached without author credentials | `tests/open.mjs:43` | asserted |
| `OPEN-001` | 2 | A real installation's areas open with no author account (installed browser) | `tests/helpers/open-browser.mjs:6` | asserted |
| `OPEN-001` | 3 | Enabling a paid provider connection shows that provider's cost in USD before activation | `tests/open.mjs:31` | asserted |
| `AGENT-002` | 1 | The investigation flags a control that passes now but failed mid-period | `tests/helpers/period-agent-journey.mjs:77` | asserted |
| `AGENT-002` | 1 | It flags the missing event window | `tests/helpers/period-agent-journey.mjs:78` | asserted |
| `AGENT-002` | 2 | Its citations follow to the original sources | `tests/helpers/period-agent-journey.mjs:98` | asserted |
| `AGENT-002` | 2 | Both the failure and the unknown interval appear | `tests/helpers/period-agent-journey.mjs:88` | asserted |
| `AGENT-002` | 3 | The proposed exception is rejected on its exact snapshot | `tests/helpers/period-agent-journey.mjs:108` | asserted |
| `AGENT-002` | 3 | No mapping or control meaning changes | `tests/helpers/period-agent-journey.mjs:113` | asserted |
| `AGENT-002` | 3 | No pass, observation or exception changes | `tests/helpers/period-agent-journey.mjs:112` | asserted |
| `AGENT-002` | 3 | No auditor decision changes | `tests/helpers/period-agent-journey.mjs:111` | asserted |
| `AGENT-005` | 1 | An approved answer linked to a passing control and contract obligation exports | `tests/helpers/promise-journey.mjs:56` | asserted |
| `AGENT-005` | 1 | Failing the control invalidates the answer and trust statement | `tests/helpers/promise-journey.mjs:66` | asserted |
| `AGENT-005` | 1 | Changing the source policy invalidates them independently | `tests/helpers/promise-journey.mjs:98` | asserted |
| `AGENT-005` | 2 | The affected customer commitments are listed | `tests/helpers/promise-journey.mjs:66` | asserted |
| `AGENT-005` | 2 | The cited revision is shown | `tests/helpers/promise-journey.mjs:104` | asserted |
| `AGENT-005` | 3 | Reusing or exporting the stale answer is refused | `tests/helpers/promise-journey.mjs:67` | asserted |
| `AGENT-005` | 3 | Sending the stale promise is refused and nothing crosses the mail edge | `tests/helpers/promise-journey.mjs:77` | asserted |
| `AGENT-005` | 3 | A fresh exact decision is required before export | `tests/helpers/promise-journey.mjs:85` | asserted |
| `AGENT-005` | 3 | The prior external version and recipient history are retained | `tests/helpers/promise-journey.mjs:75` | asserted |
| `BOUNDARY-001` | 1 | A US business chooses a HIPAA scope and sees its BAA prerequisite | `tests/program.mjs:99` | asserted |
| `BOUNDARY-001` | 1 | Data-processing prerequisites are labelled not verified by Evidence | `tests/program.mjs:100` | asserted |
| `BOUNDARY-001` | 1 | A PCI scope's prerequisites and assessor handoff are listed | `tests/program.mjs:115` | asserted |
| `BOUNDARY-001` | 1 | USD module and provider costs are shown | `tests/program.mjs:116` | asserted |
| `BOUNDARY-001` | 1 | An evidence pack exports for an independent assessor | `tests/program.mjs:119` | asserted |
| `BOUNDARY-001` | 2 | Linked remediation follows to a Vector ticket | `tests/work.mjs:142` | asserted |
| `BOUNDARY-001` | 2 | Source checks follow to the named specialist provider (AWS) | `tests/cloud.mjs:139` | asserted |
| `BOUNDARY-001` | 2 | Each specialist link opens its page | `tests/program.mjs:106` | asserted |
| `BOUNDARY-001` | 3 | No UI claims certification or legal sufficiency | `tests/program.mjs:101` | asserted |
| `BOUNDARY-001` | 3 | No report or pack claims certification | `tests/program.mjs:120` | asserted |

Rows: 633; 600 asserted, 26 none, 7 moved. Parts audited: 54; demoted to partial: 14 (CADENCE-001, FOLLOWUP-001, GAP-001, IMPORT-001, LIBRARY-002, LOG-001, OPS-001, POLICY-001, PROGRAM-001, PUBLIC-001, READINESS-001, REMEDY-001, TEST-001, WORK-003).
