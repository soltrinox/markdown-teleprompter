# Roadmap

## Public core

The browser playback engine (`src/prompter.js`), Markdown rendering,
outline navigation, reference app, tests, and deployment configuration are
public under Apache 2.0. Existing core functionality stays available without
accounts or payments. The repository is not yet an independently packaged npm
library; its exported engine functions can be imported from the source.

Potential core improvements include playback accuracy, keyboard accessibility,
font and layout preferences, mirroring, and additional browser coverage.

## Professional edition candidates

These are ideas for future development, not implemented capabilities:

- Saved script libraries, projects, and cross-device synchronization.
- Remote presenter controls and multi-display sessions.
- Recording workflows, timed rehearsals, and session analytics.
- Team collaboration, shared workspaces, and managed access.
- Premium layouts, integrations, and professional support.

Professional services and modules can be developed separately from this public
repository. Apache 2.0 permissions and attribution requirements continue to
apply to reused core code. Keep paid features outside this repository until
their release scope is deliberately chosen.
