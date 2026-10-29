<!-- Generated from CONTRACT.md by contract-docs. Edit CONTRACT.md, then regenerate. -->

# Evidence target homepage claims

A product claim is done when every clause behind it is done, missing when every one is missing, and partial otherwise. Explicit source-bound non-product facts are unassessed; their historical status is history, not current proof.

| # | Section | Claim | Clauses | Historical status | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Hero | "tests your controls around the clock" | `TEST-001` done; `LIBRARY-001` done | done | done |
| 2 | Hero | "collects the proof" | `COLLECTION-001` partial; `CLOUD-001` done; `IDENTITY-001` done; `CODE-001` partial; `PROOF-001` done | partial | partial |
| 3 | Hero | "fixes what drifts" | `REMEDY-001` done; `REMEDY-002` done; `AGENT-003` missing | partial | partial |
| 4 | Hero | "hands your auditor everything they ask for" | `AUDIT-001` done; `AUDIT-003` done; `REVIEW-001` done | partial | done |
| 5 | Hero | "100% free, open source alternative to Vanta, Drata and Secureframe" | `OPEN-001` done; `MIGRATE-001` done | done | done |
| 6 | Hero | Board: SOC 2 criteria on controls (CC6.1 Logical access, CC7.2 Monitoring) | `LIBRARY-001` done; `PROGRAM-001` done | done | done |
| 7 | Hero | Exhibit A: "MFA enforced for all 42 users · Okta" | `IDENTITY-001` done; `TEST-001` done | done | done |
| 8 | Hero | Exhibit B: "S3 buckets encrypted · AWS · 12 of 12" | `CLOUD-001` done; `TEST-001` done | done | done |
| 9 | Hero | Exhibit C: laptop disk encryption, 1 failing → fixed, re-tested | `DEVICE-001` missing; `DEVICE-002` missing; `REMEDY-001` done | partial | partial |
| 10 | Hero | "SOC 2 Type II 94% ready" | `READINESS-001` done | done | done |
| 11 | Hero | Checklist: "Policies · Access reviews · Vendor risk · Trust center" | `READINESS-001` done; `POLICY-001` done; `ACCESS-001` done; `VENDOR-001` done; `TRUST-001` partial | partial | partial |
| 12 | Hero | AWS, GitHub, Google Workspace and Okta connections | `CLOUD-001` done; `CODE-001` partial; `IDENTITY-001` done | partial | partial |
| 13 | Hero | Jamf tile; "Device systems · Endpoints" | `DEVICE-001` missing | missing | missing |
| 14 | Hero | "HR systems · People" | `HRIS-001` missing; `POPULATION-001` done | partial | partial |
| 15 | First SOC 2 | The SOC 2 Type II year: an Apr 1 – Sep 30 observation window "every control tested daily", with readiness before and after | `PROGRAM-001` done; `READINESS-001` done; `GAP-001` done; `TEST-001` done | done | done |
| 16 | First SOC 2 | "rer setup · first scan: 31 gaps" (Evidence runs on your own computer) | `OWN-001` partial; `READINESS-001` done | partial | partial |
| 17 | First SOC 2 | "15,738 daily results kept" (86 controls × 183 days) | `TEST-001` done; `PROOF-001` done | done | done |
| 18 | First SOC 2 | "Fieldwork · Harbor & Lane CPAs"; "Report issued · no exceptions" (the auditor's work, from Evidence's workspace) | `AUDIT-001` done; `BOUNDARY-001` done | done | done |
| 19 | Day one | "Connect your cloud, code, identity, HR and device systems once" | `CONNECT-001` done; `CLOUD-001` done; `CODE-001` partial; `IDENTITY-001` done; `HRIS-001` missing; `DEVICE-001` missing | partial | partial |
| 20 | Day one | "The first scan tests every SOC 2 control and names what fails" (86 controls · 55 passing · 31 to fix) | `TEST-001` done; `LIBRARY-001` done; `READINESS-001` done | done | done |
| 21 | Day one | Scan rows: AWS "CloudTrail off in 2 regions", Okta "MFA not enforced for 5 users" | `CLOUD-001` done; `IDENTITY-001` done | done | done |
| 22 | Day one | Scan row: GitHub "No branch protection on 3 repos" | `CODE-001` partial | partial | partial |
| 23 | Day one | Scan row: Jamf "4 laptops unencrypted" | `DEVICE-001` missing | missing | missing |
| 24 | Day one | Scan row: Policies "Not yet written" | `POLICY-001` done | done | done |
| 25 | Day one | Scan row: Rippling "3 leavers still active in Okta" | `HRIS-001` missing; `LIFECYCLE-001` missing | missing | missing |
| 26 | Day one | "Connected in 11 minutes: AWS, GitHub, Okta, Jamf, Rippling, Google Workspace" | `CONNECT-001` done; `CLOUD-001` done; `CODE-001` partial; `IDENTITY-001` done; `DEVICE-001` missing; `HRIS-001` missing | partial | partial |
| 27 | Fixing | "Each failing test becomes a task for the person who can fix it, in Slack or Jira" (owner and due date in #security) | `WORK-001` done; `FOLLOWUP-001` done; `FOLLOWUP-002` partial; `REMEDY-001` done | partial | partial |
| 28 | Fixing | "When the fix lands, Evidence runs the test again" ("Re-tested Mar 11 · 14 of 14 protected"; gaps 31 → 0) | `REMEDY-001` done; `REMEDY-002` done | done | done |
| 29 | Policies | "Start from templates, approve each policy once" (v1 approved by the CEO; 18 policies) | `POLICY-001` done | done | done |
| 30 | Policies | "every person signs" (42 of 42 signed; RV reminded, then signed) | `ATTEST-001` done; `FOLLOWUP-001` done | done | done |
| 31 | Policies | "and finishes training" (42 of 42 trained) | `TRAIN-001` partial | partial | partial |
| 32 | Policies | "New hires get the same list on day one" (JL signed and trained day one) | `LIFECYCLE-001` missing | missing | missing |
| 33 | Observation window | "Evidence tests every control around the clock and keeps each day's result with its time and source" | `TEST-001` done; `PROOF-001` done; `LIBRARY-001` done | done | done |
| 34 | Observation window | Day record: Okta CC6.1, AWS A1.2 and CC7.2, every day for 183 days | `IDENTITY-001` done; `CLOUD-001` done; `TEST-001` done | done | done |
| 35 | Observation window | Day record: GitHub CC8.1 change management | `CODE-001` partial; `TEST-001` done | partial | partial |
| 36 | Observation window | Day record: Jamf CC6.7 laptop encryption | `DEVICE-001` missing | missing | missing |
| 37 | Observation window | "1 failure, fixed the same day · every result kept with its source" | `TEST-001` done; `PROOF-001` done; `REMEDY-001` done | done | done |
| 38 | Evidence agent | "The agent traces a failed test to its cause, asks for one narrow fix and tests the real system again" (PR #482 → PR #487) | `AGENT-003` missing | missing | missing |
| 39 | Evidence agent | "The original failure stays on the record" ("Failure E-2291 kept · linked to its fix and re-test") | `TEST-001` done; `PROOF-001` done; `AGENT-003` missing | partial | partial |
| 40 | Interlude | "CC7.2 Monitoring · 183 of 183 days tested"; "SOC 2 Type II · 100% ready" | `READINESS-001` done; `GAP-001` done | done | done |
| 41 | Fieldwork | "Your auditor gets a workspace for your audit period" | `AUDIT-001` done; `AUDIT-003` done | partial | done |
| 42 | Fieldwork | "Each request links to tested proof with its source and time" (121 of 121 provided) | `AUDIT-001` done; `AUDIT-002` missing | partial | partial |
| 43 | Fieldwork | Requests from Okta, GitHub (25-PR sample) and the CC7.2 failure record | `IDENTITY-001` done; `CODE-001` partial; `AUDIT-002` missing; `PROOF-001` done | partial | partial |
| 44 | Fieldwork | Requests from Rippling (period-end employee list) and Jamf (183 daily results) | `HRIS-001` missing; `DEVICE-001` missing; `POPULATION-001` done | partial | partial |
| 45 | Fieldwork | Background checks from Checkr ("6 of 6 cleared") | `LIFECYCLE-001` missing | missing | missing |
| 46 | Fieldwork | Uploaded board minutes and penetration-test report as PDF | `PROOF-001` done; `VULN-002` done | done | done |
| 47 | Trust center | "Publish your report in a trust center" (Larkspur Trust Center) | `TRUST-001` partial | partial | partial |
| 48 | Trust center | "Evidence answers security questionnaires from verified proof, and every answer cites its source"; "Every answer cites its proof." | `ANSWER-001` partial | partial | partial |
| 49 | Trust center | "209 answered from evidence · 3 sent to Dana Lee" | `ANSWER-001` partial; `ANSWER-003` missing | partial | partial |
| 50 | ISO 27001 | "SOC 2, ISO 27001 and HIPAA share controls, so one passing test counts everywhere it applies" | `PROGRAM-002` done; `LIBRARY-001` done | done | done |
| 51 | ISO 27001 | "Add framework · ISO 27001:2022 · 71 of 93 controls already tested", A.5.15 ← CC6.1, A.8.24 ← CC6.7, a new control with an owner | `PROGRAM-001` done; `PROGRAM-002` done; `READINESS-001` done | done | done |
| 52 | Moving in | "Coming from Vanta, Drata or Secureframe? Import controls, policies, evidence and vendors" | `MIGRATE-001` done; `IMPORT-001` done | done | done |
| 53 | Moving in | "check every count before you switch" (86 controls, 18 policies, 1,412 evidence files, 37 vendors) | `MIGRATE-001` done; `IMPORT-001` done | done | done |
| 54 | Limits | "Evidence is not an auditor. A licensed CPA firm still tests your controls and signs your report." | `BOUNDARY-001` done | done | done |
| 55 | Closing | "Open source compliance for SOC 2, ISO 27001 and HIPAA"; "Free and open source, MIT licensed" | `PROGRAM-001` done; `OPEN-001` done | done | done |

Claims: 55; 28 done, 20 partial, 7 missing.

Historical claim source: `2a064b4ce1e9e30350a6ea887ff8e4d057f4ef8d`. Exact source files, lines, text and historical statuses are retained in CONTRACT.md's contract-claim-source record.
