# Foundation milestone status

## Implemented

- Conventional Next.js App Router runtime
- Official Supabase JavaScript and SSR clients
- ID/password login using server-side synthetic email mapping
- Cookie session refresh through the Next.js root proxy
- Database-linked role loading and server route guards
- Minimal admin, teacher, and student dashboard shells
- Authenticated password change
- Four-table PostgreSQL foundation migration
- Restrictive grants, RLS policies, role helpers, constraints, and indexes
- HMAC activation-code helper and claim-state validation logic
- Local foundation tests

## Intentionally not implemented

- Student registration endpoint or UI
- Initial account provisioning automation
- Teacher/student management screens
- Excel import
- QR generation, scanning, or rotation
- Attendance write functions or transactions
- Manual attendance and absence UI
- Attendance reports
- Advanced password recovery
- Vercel deployment

## Verification status

TypeScript, ESLint, local tests, and the production Next.js build are executed locally. The SQL migration, Auth flows, and RLS policies have not yet been executed against a real development Supabase project, so production readiness is not claimed.
