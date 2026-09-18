# Repository agent instructions

## Git push authorization

The agent is authorized to push requested changes to any branch of the `origin` remote at `https://github.com/vespy-pg/weather.git` without requesting separate confirmation.

This authorization covers standard pushes only. Force pushes, remote branch deletion, tag deletion, and pushes to any other remote still require an explicit user request.

## Git-controlled deployments

- Never modify project files directly on a deployed environment or copy individual project files to it.
- Every project file change must be committed to this repository and pushed to the `origin` GitHub remote before deployment.
- Deployments must use the committed GitHub revision so local, remote, and deployed files remain consistent.
- If a deployed checkout contains uncommitted project changes, preserve and reconcile them through Git before deploying. Do not overwrite them manually.
