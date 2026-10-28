# Period and gap rules

These are the exact rules, bounds and formats behind GAP-001 and CADENCE-001 in [CONTRACT.md](../../CONTRACT.md). The contract holds the requirement and its acceptance; this page holds the mechanism they rely on, as recorded when the contract was rewritten to the RER contract standard on 28 October 2026.

Dates are real ISO calendar dates in UTC. On the owner desk, the selected date chooses a whole calendar period: daily midnight to midnight; weekly Monday through Sunday; monthly first through last day; quarterly Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec. Covered-through is inclusive; the deadline is the next UTC midnight. The default is today's UTC date; the owner can select a historical date. These four calendar periods are the current desk periods; the semi-annual, annual and anchored periods of CADENCE-001 extend them without changing any rule in this section.

A matching receipt must cover the entire selected period and cannot have imported origin. Imported material is supplied history; a fresh owner assertion is needed to establish current proof. A receipt is current only when no newer receipt supersedes it, regardless of its covered period. Precedence is:

1. Any matching current receipt whose actual bytes cannot be read and verified: unavailable bytes, even if another matching receipt is available.
2. Matching current receipts with verified bytes: due soon in the final 20% of that selected period before its deadline; otherwise covered. For daily proof, the final 4 hours 48 minutes are due soon. Historical complete periods stay covered. This is completeness of recorded assertions, not control effectiveness.
3. Matching receipts exist but all have been superseded: superseded-only. A normal replacement may assert a different covered period; selecting the older period then reaches this state without invented records.
4. No receipts at all: missing.
5. No matching receipts, and the selected period has ended: overdue. On today's default view it is also overdue when any current receipt's covered-through has expired, making covered → due soon → overdue reachable across the calendar boundary. Otherwise: missing.

R2 or D1 failures that prevent a coherent desk return an explicit unavailable response. No failed read asserts coverage. Time is server time; only the test harness can inject a clock function. There is no production time header, query or environment override.
