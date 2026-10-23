# Fonts

Four families, each self-hosted under the SIL Open Font License 1.1 with its licence beside the files.
`/rer-theme.css` declares them beside the theme tokens, the only two things rer's theme reader takes, so the
installer serves them too. `fonts.css` holds the rest of the look, and every page that links the theme links it.

| Family | Use | Files | Licence | Upstream |
| --- | --- | --- | --- | --- |
| Schibsted Grotesk | headings and the Evidence wordmark (run site, Run page, sign-in) | `schibsted-grotesk/` (Latin, Latin Extended; weights 400–900) | `schibsted-grotesk/LICENSE.txt` | https://github.com/schibsted/schibsted-grotesk |
| Onest | body text in the app and on the run site | `onest/` (Latin; weights 100–900) | `onest/OFL.txt` | https://github.com/google/fonts/tree/main/ofl/onest |
| JetBrains Mono | fingerprints, short codes, reviewer links and the run site's terminal | `jetbrains-mono/` (Latin; weights 100–800) | `jetbrains-mono/OFL.txt` | https://github.com/JetBrains/JetBrainsMono |
| Caveat | the handwritten note on the homepage's evidence board | `caveat/` (Latin; weight 600) | `caveat/OFL.txt` | https://github.com/googlefonts/caveat |

The WOFF2 files come from Fontsource's distributions (`@fontsource-variable/schibsted-grotesk`,
`@fontsource-variable/onest`, `@fontsource-variable/jetbrains-mono`, `@fontsource/caveat` 5.2.8).
