import Link from "next/link";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import StudentImportWorkflow from "./import-workflow";

export const dynamic = "force-dynamic";

export default async function StudentImportPage() {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Administrator only</p>
          <h1>Import Students</h1>
          <p className="muted">Validate and preview one school roster before writing any Student records.</p>
        </div>
        <Link className="button button-secondary" href="/admin/students">Back to Students</Link>
      </header>
      <StudentImportWorkflow />
    </>
  );
}

