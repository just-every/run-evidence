# Risk scoring arithmetic

These are the exact rules, bounds and formats behind RISK-002 in [CONTRACT.md](../../CONTRACT.md). The contract holds the requirement and its acceptance; this page holds the mechanism they rely on, as recorded when the contract was rewritten to the RER contract standard on 28 October 2026.

The numeric score is likelihood multiplied by impact; product thresholds use inclusive upper bounds, while a matrix selects the risk-level label at its likelihood row and impact column. Suggested 1–5 library values are scaled to the chosen size, rounded to the nearest whole number and clamped to the scale. Legacy definitions not recorded are labeled as such.
