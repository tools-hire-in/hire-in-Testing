# Hire’in AI BD Agent — First Replit Prompt
## Task 0: Repository Discovery and Change-Safety Audit

Attach or add the full file:

`Hirein_AI_BD_Agent_Replit_Architecture_and_Implementation_Guide.md`

Then paste the following prompt into Replit:

---

You are working inside the existing Hire’in Solutions production codebase.

Use the attached **“Hire’in Solutions AI Business Development Agent — Replit Architecture, Secret-Sauce Knowledge System, and Phased Implementation Guide”** as product and architecture context.

For this task, **do not implement the BD Agent and do not modify application behavior**.

Inspect the entire existing repository and produce a codebase discovery and change-safety report covering:

1. the current frontend and backend architecture;
2. exact package versions, build scripts, deployment configuration, and environment-variable conventions;
3. authentication, sessions, protected routes, password handling, and login flow;
4. authorization, role definitions, database enums, middleware, and any centralized feature-to-role access registry;
5. database schema organization, migration history, current migration procedure, and risks of adding BD tables or vector fields;
6. API client, TanStack Query usage, server response format, validation, error handling, pagination, and streaming conventions;
7. current file upload, storage, encryption, audit logging, server logging, telemetry, and background-job mechanisms;
8. all existing AI integrations, OpenAI/provider wrappers, prompts, agents, conversation storage, Content Studio, Campaign features, BD Agent code, deck/document parsing, embeddings, search, and knowledge-base functionality;
9. current navigation and the safest location for the BD module;
10. reusable components, services, repositories, schemas, middleware, and utilities;
11. conflicts between the architecture guide’s assumptions and the actual repository;
12. the smallest safe implementation map for Tasks 1–5, listing likely files to modify and existing functionality to reuse.

Mandatory rules:

- Search thoroughly before concluding a capability is absent.
- Cite exact file paths, exported symbols, routes, tables, and configuration keys in the audit.
- Do not create a second authentication system, users table, API client, database, upload service, encryption helper, audit system, or AI provider wrapper.
- Do not add dependencies, database tables, migrations, routes, role values, prompts, or UI in this task.
- Do not run destructive database commands or schema synchronization.
- Do not refactor unrelated code.
- You may create only one documentation file, preferably `docs/bd-agent-codebase-audit.md`, if creating a report file fits the repository’s conventions.
- Stop after the audit. Do not continue into implementation.

The final audit must include:

- verified current-state architecture;
- reusable building blocks;
- role and migration risks;
- data-security considerations;
- recommended feature boundary;
- recommended exact order for Tasks 1–5;
- open questions that can only be answered from product ownership or production configuration;
- confirmation that no functional code was changed.

