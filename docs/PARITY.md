# Web ↔ Android parity matrix

Basis: web `0.1.0` and Android `2.0.0-beta5`. Android source of truth:
`ui/DiariumApp.kt` (Settings order) and `ui/onboarding/OnboardingState.kt`.

| Area | Web | Android | Notes |
|---|---|---|---|
| Google sign-in | yes | yes | Supabase OAuth in both |
| Five destinations | yes | yes | Overview, Today, History, Stats, Settings |
| Language | yes | yes | Web stores `diarium-lang`; Android stores its own preference |
| Journal data | yes | yes | Same Supabase tables |
| Goals / scales / templates / achievements | yes | yes | Reachable from Settings → Deník |
| AI weekly/monthly reports | yes | yes | Server-side DeepSeek on web |
| CSV export | server-generated | on-device | Same columns, order, quoting, LF, no BOM |
| PDF export | yes (reduced summary) | no | Web-only |
| Google Photos picker | yes | no | Web-only |
| Yearly overview | yes | no | Web-only |
| About / version / public links | yes | no | Web-only screen |
| Profile (name, birth year) | no | yes | Android stores it on the phone only |
| First-run onboarding | no | yes | Android has 4 steps: profile, AI, habits, goals |
| BYOK AI key | no | yes | Android keeps it encrypted on-device |
| Notification scheduling | no | yes | Web push is transport only; Android schedules locally |
| Screen-time collection | no | yes | Android `UsageStatsManager`; web only displays synced data |
| Theme switch | no | no | Both are dark-only by design |
| Account deletion | no | no | Known gap — see below |

## Known gap: account deletion

Neither the web nor Android beta5 can delete an account. Supabase cascades
`auth.users` → `profiles` / `entries` / goals, but `diary-photos` Storage objects
are **not** cascaded and would need explicit removal. Because a button that only
signed the user out would be dishonest, Settings shows no delete action; About
states the gap in plain language. Implementing deletion requires an
authenticated `DELETE /api/account/delete` that verifies the user, removes the
`<userId>/` Storage prefix, deletes the auth user and returns counts.
