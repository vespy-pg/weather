# Repository agent instructions

All generated project artifacts must be written in English. English must remain the default and fallback language.

Shared rules in `~/.ai/rules/` are the source of truth for machine-wide AI behaviour. Do not duplicate them here.

## GitHub pull request reviews

- Use the `github-pr-review` skill for every GitHub pull request review or re-review.

## Git push authorization

- Standard pushes requested by the user are authorized only for the `origin` remote at `https://github.com/vespy-pg/weather.git`.
- Force pushes, remote branch deletion, tag deletion and pushes to any other remote require explicit user authorization.

## Git-controlled deployments

- Never modify project files directly on a deployed environment or copy individual project files to it.
- Commit and push every project file change before deployment.
- Deploy the committed GitHub revision so local, remote and deployed files remain consistent.
- Preserve and reconcile uncommitted deployed changes through Git before deploying.

## Public contact

- The public contact email address for this project is `vespy.weather@gmail.com`.
- Use this address in public-facing project content, store listings, privacy information and support instructions.

## Android releases

- Every new Android version must include release notes for every supported Google Play locale.
- The currently supported release-note locales are `en-US` and `pl-PL`.
- Update both `play/store-listing/en-US/release-notes.txt` and `play/store-listing/pl-PL/release-notes.txt` whenever `versionCode` or `versionName` changes.
- Treat adding another Google Play locale as automatically extending this requirement to that locale.
