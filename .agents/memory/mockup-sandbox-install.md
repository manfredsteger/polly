---
name: Mockup sandbox dependency setup
description: Newly created mockup sandboxes can have an empty node_modules directory despite a complete package.json
---

- After creating a mockup sandbox, confirm its local dependencies exist before relying on the preview workflow.
- **Why:** the generated sandbox package can exist with an empty `node_modules`; Vite then reports that it cannot resolve `tailwindcss` even though the package is declared.
- **How to apply:** if the sandbox workflow reports a missing package immediately after artifact creation, run `npm install` from the sandbox directory, restart its preview workflow, and verify a real `/__mockup/preview/...` page with a screenshot. For a standalone production build, supply the workflow-provided `BASE_PATH` and `PORT` environment values.
