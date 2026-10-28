# Remediation SLA arithmetic

These are the exact rules, bounds and formats behind REMEDY-002 in [CONTRACT.md](../../CONTRACT.md). The contract holds the requirement and its acceptance; this page holds the mechanism they rely on, as recorded when the contract was rewritten to the RER contract standard on 28 October 2026.

SLA days are 24-hour UTC intervals. Approved exception intervals are clipped to the running failure cycle and counted as a union, so overlap never pauses time twice; expiry or revocation ends its interval. The running cycle keeps its policy revision and original first-failure time until a verified pass; a regression after that pass starts a new cycle under the policy then in force. Time to remediate is elapsed wall-clock hours from first failure to verified pass, rounded to the nearest whole hour (half-hours up), including paused time; open work has no completed duration.

Status note: All current category/clock/tracker doors asserted, including overlap, policy changes, regression and CSV duration; ISSUES-001 and VULN-001 carry their source-specific clocks and outcomes before shipping.
