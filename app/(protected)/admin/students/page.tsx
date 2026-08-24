import Link from "next/link";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { listStudents } from "@/lib/students/student-management";

export const dynamic = "force-dynamic";

type StudentPageProps = {
  searchParams: Promise<{ query?: string; class?: string }>;
};

export default async function StudentsPage({ searchParams }: StudentPageProps) {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  const students = await listStudents();
  const params = await searchParams;
  const query = (params.query ?? "").trim().toLowerCase();
  const classFilter = (params.class ?? "").trim();
  const classes = [...new Set(students.map((student) => student.className).filter(Boolean))].sort();
  const filtered = students.filter((student) => {
    const matchesQuery =
      !query ||
      student.loginId.toLowerCase().includes(query) ||
      student.fullName.toLowerCase().includes(query);
    return matchesQuery && (!classFilter || student.className === classFilter);
  });

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Administrator only</p>
          <h1>Student Management</h1>
          <p className="muted">View the imported roster. Activation controls are intentionally not included yet.</p>
        </div>
        <div className="page-actions">
          <Link className="button button-primary" href="/admin/students/import">Import Students</Link>
          <Link className="button button-secondary" href="/admin">Back</Link>
        </div>
      </header>

      <section className="card">
        <form className="student-filters" method="get">
          <div className="field">
            <label htmlFor="student-query">Student ID or name</label>
            <input id="student-query" name="query" defaultValue={params.query ?? ""} type="search" />
          </div>
          <div className="field">
            <label htmlFor="student-class">Class</label>
            <select id="student-class" name="class" defaultValue={classFilter}>
              <option value="">All classes</option>
              {classes.map((className) => <option key={className} value={className}>{className}</option>)}
            </select>
          </div>
          <button className="button button-secondary" type="submit">Filter</button>
        </form>

        <p className="muted">Showing {filtered.length} of {students.length} Students.</p>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Student ID</th><th>Type</th><th>Name</th><th>Class</th><th>Status</th><th>Activation</th><th>Action</th></tr></thead>
            <tbody>
              {filtered.map((student) => (
                <tr key={student.loginId}>
                  <td><strong>{student.loginId}</strong></td>
                  <td>{student.idType}</td>
                  <td>{student.fullName}</td>
                  <td>{student.className}</td>
                  <td>{student.isActive ? "Active" : "Inactive"}</td>
                  <td>{student.isActivated ? "Activated" : student.hasActivationCode ? "Code prepared" : "Code not prepared"}</td>
                  <td>
                    <Link
                      className="button button-secondary button-small"
                      href={`/admin/students/${encodeURIComponent(student.loginId)}/activation`}
                    >
                      Manage activation
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? <p className="muted">No Students match this view.</p> : null}
      </section>
    </>
  );
}
