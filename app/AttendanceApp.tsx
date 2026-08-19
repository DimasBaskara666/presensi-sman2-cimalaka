"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

type Role = "login" | "admin" | "teacher" | "student";
type Tone = "navy" | "green" | "gold" | "red";

const attendanceRows = [
  { id: "10024", name: "Rania Putri Maharani", className: "XI MIPA 1", time: "06:41", type: "Masuk", status: "Tepat waktu", method: "QR" },
  { id: "10118", name: "Fikri Alfarizi", className: "X IPS 2", time: "06:43", type: "Masuk", status: "Tepat waktu", method: "QR" },
  { id: "10087", name: "Kayla Nur Azizah", className: "XII MIPA 2", time: "06:46", type: "Masuk", status: "Tepat waktu", method: "QR" },
  { id: "10033", name: "Muhammad Raihan", className: "XI IPS 1", time: "06:49", type: "Masuk", status: "Tepat waktu", method: "Manual" },
  { id: "10142", name: "Naila Salsabila", className: "X MIPA 3", time: "07:17", type: "Masuk", status: "Terlambat", method: "QR" },
  { id: "10061", name: "Dimas Pratama", className: "XII IPS 1", time: "07:21", type: "Masuk", status: "Terlambat", method: "QR" },
];

const students = [
  { id: "10001", name: "Alya Rahmadani", className: "XI MIPA 1", account: "Aktif", attendance: "96%" },
  { id: "10002", name: "Bagas Mahendra", className: "XI MIPA 1", account: "Aktif", attendance: "94%" },
  { id: "10003", name: "Citra Lestari", className: "XI MIPA 1", account: "Belum diklaim", attendance: "—" },
  { id: "10004", name: "Daffa Akbar", className: "XI IPS 2", account: "Aktif", attendance: "91%" },
  { id: "10005", name: "Elsa Nuraini", className: "X MIPA 2", account: "Nonaktif", attendance: "88%" },
];

const teachers = [
  { id: "G001", name: "Ibu Siti Nurhayati, S.Pd.", status: "Aktif", last: "Hari ini, 06:05" },
  { id: "G002", name: "Bapak Dedi Kurniawan, S.Pd.", status: "Aktif", last: "Kemarin, 14:12" },
  { id: "G003", name: "Ibu Rina Kartika, M.Pd.", status: "Aktif", last: "18 Agu, 06:02" },
];

const navByRole = {
  admin: [
    ["⌂", "Ringkasan"], ["♙", "Data siswa"], ["♧", "Data guru"], ["◫", "Riwayat presensi"], ["⚙", "Konfigurasi"],
  ],
  teacher: [
    ["⌂", "Ringkasan"], ["▦", "QR presensi"], ["✚", "Presensi manual"], ["◫", "Riwayat presensi"],
  ],
  student: [
    ["⌂", "Hari ini"], ["◎", "Pindai QR"], ["◫", "Riwayat saya"],
  ],
} as const;

function Mark({ small = false }: { small?: boolean }) {
  return <div className={`school-mark ${small ? "school-mark-small" : ""}`} aria-label="Identitas sementara SMA Negeri 2 Cimalaka"><span>02</span></div>;
}

function StatusPill({ children, tone = "green" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`status-pill ${tone}`}><i aria-hidden="true" />{children}</span>;
}

function IconBox({ children, tone = "navy" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`icon-box ${tone}`} aria-hidden="true">{children}</span>;
}

function LoginScreen({ onLogin }: { onLogin: (role: Role) => void }) {
  const [registering, setRegistering] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!loginId || !password) {
      setNotice("Lengkapi ID dan password untuk melanjutkan.");
      return;
    }
    const id = loginId.trim().toUpperCase();
    if (id === "ADMIN") onLogin("admin");
    else if (id.startsWith("G")) onLogin("teacher");
    else onLogin("student");
  };

  const useDemo = (id: string) => {
    setLoginId(id);
    setPassword("demo123");
    setNotice("");
  };

  return (
    <main className="login-shell">
      <section className="brand-panel" aria-label="Tentang sistem presensi">
        <Mark />
        <div className="brand-copy">
          <p className="eyebrow">SMA NEGERI 2 CIMALAKA</p>
          <h1>Presensi sekolah,<br />lebih tertib setiap hari.</h1>
          <p className="brand-description">Sistem presensi QR untuk kedatangan dan kepulangan siswa yang cepat, aman, dan mudah dipantau.</p>
        </div>
        <div className="brand-meta"><span className="status-dot" />Sistem siap digunakan<span className="meta-separator" />Asia/Jakarta</div>
      </section>

      <section className="auth-panel">
        <div className="mobile-brand"><Mark small /><div><strong>SMAN 2 Cimalaka</strong><small>Sistem Presensi</small></div></div>
        <div className="login-card">
          {!registering ? (
            <>
              <header><p className="eyebrow dark">PORTAL PRESENSI</p><h2>Selamat datang</h2><p>Masuk menggunakan ID atau username yang telah terdaftar.</p></header>
              <form onSubmit={submit}>
                <label htmlFor="login-id">ID / Username</label>
                <div className="field-wrap"><span>#</span><input id="login-id" value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="Contoh: 10001 atau G001" autoComplete="username" /></div>
                <div className="label-row"><label htmlFor="password">Password</label><button type="button" className="text-button" onClick={() => setNotice("Pemulihan password siswa ditangani oleh admin sekolah.")}>Lupa password?</button></div>
                <div className="field-wrap"><span>●</span><input id="password" value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} placeholder="Masukkan password" autoComplete="current-password" /><button type="button" className="field-action" onClick={() => setShowPassword((v) => !v)}>{showPassword ? "Tutup" : "Lihat"}</button></div>
                {notice && <p className="form-notice">{notice}</p>}
                <button className="primary-button" type="submit">Masuk ke sistem <span>→</span></button>
              </form>
              <div className="demo-access"><span>AKUN DEMONSTRASI</span><div><button onClick={() => useDemo("ADMIN")}>Admin</button><button onClick={() => useDemo("G001")}>Guru</button><button onClick={() => useDemo("10001")}>Siswa</button></div></div>
              <div className="divider"><span>atau</span></div>
              <p className="register-prompt">Siswa belum memiliki akun?<button type="button" className="secondary-button" onClick={() => { setRegistering(true); setNotice(""); }}>Buat akun siswa</button></p>
            </>
          ) : (
            <Registration onBack={() => setRegistering(false)} />
          )}
        </div>
        <footer><span>© 2026 SMA Negeri 2 Cimalaka</span><button type="button">Bantuan</button><button type="button">Kebijakan Privasi</button></footer>
      </section>
    </main>
  );
}

function Registration({ onBack }: { onBack: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <div className="registration-view">
      <button className="back-button" onClick={onBack}>← Kembali ke login</button>
      {!done ? <>
        <header><p className="eyebrow dark">REGISTRASI SISWA</p><h2>Buat akun siswa</h2><p>Gunakan ID yang terdaftar pada data induk sekolah.</p></header>
        <form onSubmit={(e) => { e.preventDefault(); setDone(true); }}>
          <label htmlFor="student-id">ID Siswa</label><div className="field-wrap"><span>#</span><input id="student-id" defaultValue="10001" /></div>
          <label className="standalone-label" htmlFor="new-password">Buat password</label><div className="field-wrap"><span>●</span><input id="new-password" type="password" defaultValue="demo123" /></div>
          <label className="standalone-label" htmlFor="confirm-password">Konfirmasi password</label><div className="field-wrap"><span>✓</span><input id="confirm-password" type="password" defaultValue="demo123" /></div>
          <p className="security-note"><strong>Data tetap aman.</strong> Nama dan kelas diambil dari data sekolah, bukan dari isian ini.</p>
          <button className="primary-button" type="submit">Buat akun <span>→</span></button>
        </form>
      </> : <div className="success-state"><span>✓</span><h2>Akun berhasil dibuat</h2><p>ID 10001 kini siap digunakan untuk masuk ke sistem.</p><button className="primary-button" onClick={onBack}>Kembali ke login</button></div>}
    </div>
  );
}

function AppShell({ role, onLogout }: { role: Exclude<Role, "login">; onLogout: () => void }) {
  const [active, setActive] = useState(navByRole[role][0][1]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const identity = role === "admin" ? ["Administrator", "Admin Sistem", "AD"] : role === "teacher" ? ["Ibu Siti Nurhayati", "Guru Piket · G001", "SN"] : ["Alya Rahmadani", "XI MIPA 1 · 10001", "AR"];
  const title = active;

  const navigate = (label: string) => {
    setActive(label as typeof active);
    setMobileOpen(false);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="sidebar-brand"><Mark small /><div><strong>SMAN 2 Cimalaka</strong><span>Portal Presensi</span></div><button className="mobile-close" onClick={() => setMobileOpen(false)}>×</button></div>
        <div className="role-label">{role === "admin" ? "ADMINISTRASI" : role === "teacher" ? "OPERASIONAL" : "AKUN SISWA"}</div>
        <nav aria-label="Navigasi utama">
          {navByRole[role].map(([icon, label]) => <button key={label} className={active === label ? "active" : ""} onClick={() => navigate(label)}><span>{icon}</span>{label}</button>)}
        </nav>
        <div className="preview-badge"><span>PRATINJAU</span><p>Data di layar ini adalah data demonstrasi.</p></div>
        <div className="sidebar-profile"><div className="avatar">{identity[2]}</div><div><strong>{identity[0]}</strong><span>{identity[1]}</span></div><button aria-label="Keluar" onClick={onLogout}>↪</button></div>
      </aside>
      {mobileOpen && <button className="scrim" aria-label="Tutup navigasi" onClick={() => setMobileOpen(false)} />}
      <section className="workspace">
        <header className="topbar"><button className="menu-button" onClick={() => setMobileOpen(true)}>☰</button><div><p>{role === "admin" ? "Admin" : role === "teacher" ? "Guru Piket" : "Siswa"} / <span>{title}</span></p></div><div className="topbar-actions"><button className="notification-button" aria-label="Notifikasi">♢<i /></button><div className="avatar">{identity[2]}</div></div></header>
        <div className="workspace-content">
          {role === "admin" && <AdminContent active={active} />}
          {role === "teacher" && <TeacherContent active={active} />}
          {role === "student" && <StudentContent active={active} navigate={navigate} />}
        </div>
      </section>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div>{action}</div>;
}

function StatCard({ icon, label, value, detail, tone = "navy" }: { icon: string; label: string; value: string; detail: string; tone?: Tone }) {
  return <article className="stat-card"><div className="stat-card-top"><IconBox tone={tone}>{icon}</IconBox><span className={`trend ${tone}`}>{detail}</span></div><p>{label}</p><strong>{value}</strong></article>;
}

function AdminContent({ active }: { active: string }) {
  if (active === "Data siswa") return <StudentsPage />;
  if (active === "Data guru") return <TeachersPage />;
  if (active === "Riwayat presensi") return <HistoryPage />;
  if (active === "Konfigurasi") return <SettingsPage />;
  return <AdminOverview />;
}

function AdminOverview() {
  return <>
    <PageHeading eyebrow="KAMIS, 20 AGUSTUS 2026" title="Selamat pagi, Administrator" description="Berikut ringkasan aktivitas presensi sekolah hari ini." action={<button className="outline-button">↓ Unduh laporan</button>} />
    <div className="stats-grid"><StatCard icon="♙" label="Total siswa" value="1.184" detail="12 kelas" /><StatCard icon="✓" label="Hadir hari ini" value="1.126" detail="95,1%" tone="green" /><StatCard icon="◷" label="Terlambat" value="14" detail="1,2%" tone="gold" /><StatCard icon="—" label="Belum hadir" value="44" detail="3,7%" tone="red" /></div>
    <div className="admin-grid">
      <section className="panel attendance-chart"><div className="panel-heading"><div><h2>Tren kehadiran</h2><p>Persentase kehadiran 7 hari terakhir</p></div><select aria-label="Rentang tren"><option>7 hari</option></select></div><div className="chart-wrap"><div className="chart-y"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><div className="bars">{[[92,"Kam"],[96,"Jum"],[89,"Sen"],[94,"Sel"],[97,"Rab"],[95,"Kam"],[95,"Hari ini"]].map(([h,d],i)=><div className="bar-column" key={String(d)}><div className={`bar ${i===6?"current":""}`} style={{height:`${Number(h)*.78}%`}}><span>{h}%</span></div><small>{d}</small></div>)}</div></div></section>
      <section className="panel class-summary"><div className="panel-heading"><div><h2>Kehadiran per tingkat</h2><p>Ringkasan hari ini</p></div><button>•••</button></div>{[["Kelas X",382,398,96],["Kelas XI",371,394,94],["Kelas XII",373,392,95]].map(([label,present,total,pct])=><div className="class-row" key={String(label)}><div><strong>{label}</strong><span>{present} dari {total} siswa</span></div><b>{pct}%</b><div className="progress"><i style={{width:`${pct}%`}} /></div></div>)}</section>
    </div>
    <section className="panel table-panel"><div className="panel-heading"><div><h2>Presensi terbaru</h2><p>Pembaruan secara langsung hari ini</p></div><button className="text-link">Lihat semua →</button></div><AttendanceTable rows={attendanceRows.slice(0,5)} /></section>
  </>;
}

function StudentsPage() {
  return <><PageHeading eyebrow="DATA INDUK" title="Data siswa" description="Kelola data dan status pendaftaran akun siswa." action={<div className="heading-actions"><button className="outline-button">↑ Impor CSV</button><button className="solid-button">＋ Tambah siswa</button></div>} /><section className="panel table-panel"><div className="filterbar"><div className="search-field">⌕<input placeholder="Cari ID atau nama siswa..." /></div><select><option>Semua kelas</option></select><select><option>Semua status</option></select></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>ID SISWA</th><th>NAMA</th><th>KELAS</th><th>STATUS AKUN</th><th>KEHADIRAN</th><th /></tr></thead><tbody>{students.map((s)=><tr key={s.id}><td className="mono">{s.id}</td><td><strong>{s.name}</strong></td><td>{s.className}</td><td><StatusPill tone={s.account==="Aktif"?"green":s.account==="Nonaktif"?"red":"gold"}>{s.account}</StatusPill></td><td><strong>{s.attendance}</strong></td><td><button className="row-action">•••</button></td></tr>)}</tbody></table></div><div className="table-footer"><span>Menampilkan 5 dari 1.184 siswa</span><div><button>←</button><button className="current">1</button><button>2</button><button>3</button><button>→</button></div></div></section></>;
}

function TeachersPage() {
  return <><PageHeading eyebrow="AKUN OPERASIONAL" title="Data guru" description="Kelola akun guru piket dan akses operasional." action={<button className="solid-button">＋ Tambah guru</button>} /><div className="teacher-stats"><div><IconBox>♧</IconBox><span>Total akun guru<strong>3</strong></span></div><div><IconBox tone="green">✓</IconBox><span>Akun aktif<strong>3</strong></span></div><div><IconBox tone="gold">◷</IconBox><span>Piket hari ini<strong>2</strong></span></div></div><section className="panel table-panel"><div className="panel-heading"><div><h2>Daftar guru</h2><p>ID guru dibuat sesuai konvensi sekolah</p></div><div className="search-field compact">⌕<input placeholder="Cari guru..." /></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>ID GURU</th><th>NAMA LENGKAP</th><th>STATUS</th><th>AKTIVITAS TERAKHIR</th><th /></tr></thead><tbody>{teachers.map((t)=><tr key={t.id}><td className="mono">{t.id}</td><td><div className="person-cell"><div className="avatar pale">{t.name.split(" ").slice(1,3).map(n=>n[0]).join("")}</div><strong>{t.name}</strong></div></td><td><StatusPill>{t.status}</StatusPill></td><td>{t.last}</td><td><button className="row-action">•••</button></td></tr>)}</tbody></table></div></section></>;
}

function HistoryPage() {
  return <><PageHeading eyebrow="MONITORING" title="Riwayat presensi" description="Telusuri dan filter seluruh catatan presensi siswa." action={<button className="outline-button">↓ Ekspor CSV</button>} /><section className="panel table-panel"><div className="filterbar"><div className="search-field">⌕<input placeholder="Cari siswa..." /></div><input className="date-input" type="date" defaultValue="2026-08-20" /><select><option>Semua tipe</option><option>Masuk</option><option>Pulang</option></select><select><option>Semua metode</option></select></div><AttendanceTable rows={attendanceRows} /><div className="table-footer"><span>6 catatan ditampilkan · Waktu Asia/Jakarta</span><div><button className="current">1</button></div></div></section></>;
}

function SettingsPage() {
  const [saved, setSaved] = useState(false);
  return <><PageHeading eyebrow="ATURAN SISTEM" title="Konfigurasi presensi" description="Atur waktu presensi dan masa berlaku QR. Nilai ini masih bersifat sementara." /><div className="settings-grid"><section className="panel settings-panel"><div className="panel-heading"><div><h2>Waktu presensi</h2><p>Gunakan zona waktu Asia/Jakarta</p></div><IconBox>◷</IconBox></div><div className="time-rule"><div><strong>Kedatangan</strong><span>Batas waktu siswa melakukan check-in</span></div><label>Mulai<input type="time" defaultValue="06:00" /></label><label>Selesai<input type="time" defaultValue="07:15" /></label></div><div className="time-rule"><div><strong>Kepulangan</strong><span>Batas waktu siswa melakukan check-out</span></div><label>Mulai<input type="time" defaultValue="14:00" /></label><label>Selesai<input type="time" defaultValue="17:00" /></label></div></section><section className="panel settings-panel"><div className="panel-heading"><div><h2>QR & keamanan</h2><p>Pengaturan token presensi</p></div><IconBox tone="gold">▦</IconBox></div><label className="setting-field">Masa berlaku QR<div><input type="number" defaultValue="5" /><span>menit</span></div></label><label className="toggle-row"><span><strong>Satu QR aktif</strong><small>Nonaktifkan token lama saat QR baru dibuat</small></span><input type="checkbox" defaultChecked /></label><label className="toggle-row"><span><strong>Check-out wajib check-in</strong><small>Kebijakan ini menunggu konfirmasi sekolah</small></span><input type="checkbox" /></label><div className="provisional-note"><strong>Perlu konfirmasi sekolah</strong><p>Definisi terlambat dan kebijakan check-out belum ditetapkan.</p></div></section></div><div className="save-bar"><span>{saved ? "✓ Perubahan tersimpan untuk sesi pratinjau" : "Periksa kembali sebelum menyimpan perubahan."}</span><button className="solid-button" onClick={() => setSaved(true)}>Simpan perubahan</button></div></>;
}

function AttendanceTable({ rows }: { rows: typeof attendanceRows }) {
  return <div className="data-table-wrap"><table className="data-table"><thead><tr><th>SISWA</th><th>KELAS</th><th>WAKTU</th><th>TIPE</th><th>STATUS</th><th>METODE</th></tr></thead><tbody>{rows.map((row)=><tr key={`${row.id}-${row.time}`}><td><div className="student-cell"><div className="avatar pale">{row.name.split(" ").slice(0,2).map(n=>n[0]).join("")}</div><div><strong>{row.name}</strong><span>{row.id}</span></div></div></td><td>{row.className}</td><td className="mono">{row.time}</td><td><span className="type-label">{row.type === "Masuk" ? "↘" : "↗"} {row.type}</span></td><td><StatusPill tone={row.status === "Terlambat" ? "gold" : "green"}>{row.status}</StatusPill></td><td><span className="method-label">{row.method}</span></td></tr>)}</tbody></table></div>;
}

function TeacherContent({ active }: { active: string }) {
  const [qrActive, setQrActive] = useState(true);
  const [seconds, setSeconds] = useState(287);
  const [type, setType] = useState<"Masuk" | "Pulang">("Masuk");
  const [manualOpen, setManualOpen] = useState(active === "Presensi manual");
  useEffect(() => { if (!qrActive) return; const timer = window.setInterval(() => setSeconds((s) => s > 0 ? s - 1 : 0), 1000); return () => window.clearInterval(timer); }, [qrActive]);
  useEffect(() => { if (active === "Presensi manual") setManualOpen(true); }, [active]);
  const refreshQr = () => { setSeconds(300); setQrActive(true); };
  const minutes = String(Math.floor(seconds / 60)).padStart(2,"0");
  const secs = String(seconds % 60).padStart(2,"0");
  return <>
    <PageHeading eyebrow="KAMIS, 20 AGUSTUS 2026" title={active === "Riwayat presensi" ? "Riwayat presensi" : "Operasional presensi"} description={active === "Riwayat presensi" ? "Lihat catatan presensi siswa yang telah masuk." : "Kelola QR aktif dan pantau kedatangan siswa secara langsung."} action={<StatusPill>Sistem daring</StatusPill>} />
    {active === "Riwayat presensi" ? <section className="panel table-panel"><AttendanceTable rows={attendanceRows} /></section> : <div className="teacher-layout">
      <section className="panel qr-panel"><div className="panel-heading"><div><h2>QR presensi aktif</h2><p>Gunakan kode yang sama di seluruh gerbang</p></div><div className="segmented"><button className={type === "Masuk" ? "active" : ""} onClick={() => setType("Masuk")}>Masuk</button><button className={type === "Pulang" ? "active" : ""} onClick={() => setType("Pulang")}>Pulang</button></div></div><div className={`qr-stage ${!qrActive || seconds === 0 ? "expired" : ""}`}><div className="qr-frame"><QrPattern /></div><p>QR PRESENSI {type.toUpperCase()}</p><span>{qrActive && seconds > 0 ? `Berlaku ${minutes}:${secs}` : "QR telah kedaluwarsa"}</span></div><div className="qr-actions"><button className="outline-button" onClick={() => setQrActive(false)}>Nonaktifkan</button><button className="solid-button" onClick={refreshQr}>↻ Buat QR baru</button></div><p className="qr-security">⌁ Token dienkripsi dan otomatis kedaluwarsa setelah 5 menit.</p></section>
      <div className="teacher-side"><section className="live-card"><div><span className="live-dot" /> LIVE</div><p>Siswa hadir hari ini</p><strong>1.126</strong><span>dari 1.184 siswa · 95,1%</span><div className="live-progress"><i /></div></section><section className="panel quick-panel"><div className="panel-heading"><div><h2>Aksi cepat</h2><p>Operasional hari ini</p></div></div><button onClick={() => setManualOpen(true)}><IconBox tone="gold">✚</IconBox><span><strong>Presensi manual</strong><small>Untuk siswa tanpa ponsel</small></span><b>→</b></button><button><IconBox tone="green">◫</IconBox><span><strong>Lihat riwayat</strong><small>Periksa catatan hari ini</small></span><b>→</b></button></section><section className="panel recent-mini"><div className="panel-heading"><div><h2>Baru saja masuk</h2><p>Pembaruan langsung</p></div></div>{attendanceRows.slice(0,3).map((r)=><div className="mini-person" key={r.id}><div className="avatar pale">{r.name.split(" ").slice(0,2).map(n=>n[0]).join("")}</div><span><strong>{r.name}</strong><small>{r.className}</small></span><time>{r.time}</time></div>)}</section></div>
    </div>}
    {manualOpen && <ManualModal onClose={() => setManualOpen(false)} />}
  </>;
}

function QrPattern() {
  const cells = useMemo(() => Array.from({length: 625}, (_,i) => { const r=Math.floor(i/25), c=i%25; const finder=(rr:number,cc:number)=>r>=rr&&r<rr+7&&c>=cc&&c<cc+7&&(r===rr||r===rr+6||c===cc||c===cc+6||(r>=rr+2&&r<=rr+4&&c>=cc+2&&c<=cc+4)); return finder(0,0)||finder(0,18)||finder(18,0)||((r*17+c*31+r*c*7)%11<5 && !((r<8&&c>16)||(c<8&&r>16))); }), []);
  return <div className="qr-grid" aria-label="Representasi kode QR aktif">{cells.map((on,i)=><i key={i} className={on?"on":""} />)}</div>;
}

function ManualModal({ onClose }: { onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="manual-title"><div className="modal-card"><button className="modal-close" onClick={onClose}>×</button>{!saved ? <><p className="eyebrow dark">PRESENSI MANUAL</p><h2 id="manual-title">Catat kehadiran siswa</h2><p className="modal-description">Digunakan untuk siswa yang tidak dapat memindai QR.</p><label>Cari ID atau nama siswa<div className="search-field modal-search">⌕<input defaultValue="10001" /></div></label><div className="selected-student"><div className="avatar">AR</div><span><strong>Alya Rahmadani</strong><small>10001 · XI MIPA 1</small></span><i>✓</i></div><label>Jenis presensi<div className="manual-options"><button className="active">↘ Masuk</button><button>↗ Pulang</button></div></label><label>Catatan opsional<textarea placeholder="Alasan atau keterangan..." /></label><button className="primary-button" onClick={() => setSaved(true)}>Simpan presensi <span>→</span></button></> : <div className="success-state compact"><span>✓</span><h2>Presensi tercatat</h2><p>Alya Rahmadani dicatat hadir pukul 06:52 oleh G001.</p><button className="primary-button" onClick={onClose}>Selesai</button></div>}</div></div>;
}

function StudentContent({ active, navigate }: { active: string; navigate: (label: string) => void }) {
  const [scanResult, setScanResult] = useState(false);
  if (active === "Riwayat saya") return <StudentHistory />;
  return <>
    <PageHeading eyebrow="KAMIS, 20 AGUSTUS 2026" title="Selamat pagi, Alya" description="Pastikan presensi kedatangan dan kepulanganmu tercatat hari ini." action={<StatusPill>Data diperbarui</StatusPill>} />
    <div className="student-hero"><div><p>STATUS HARI INI</p><h2>Kedatanganmu sudah tercatat.</h2><span>Kamu tiba tepat waktu. Tetap semangat belajar hari ini!</span><div className="student-hero-actions"><button className="light-button" onClick={() => setScanResult(true)}>◎ Pindai QR kepulangan</button><button className="ghost-button" onClick={() => navigate("Riwayat saya")}>Lihat riwayat →</button></div></div><div className="hero-check">✓<i /></div></div>
    <div className="student-status-grid"><article className="status-card done"><div><IconBox tone="green">↘</IconBox><StatusPill>SELESAI</StatusPill></div><p>Kedatangan</p><strong>06:41</strong><span>Tepat waktu · Gerbang sekolah</span></article><article className="status-card pending"><div><IconBox tone="gold">↗</IconBox><StatusPill tone="gold">MENUNGGU</StatusPill></div><p>Kepulangan</p><strong>— — : — —</strong><span>Tersedia mulai pukul 14:00</span></article><article className="status-card attendance-score"><div><IconBox>◉</IconBox><span>AGUSTUS 2026</span></div><p>Tingkat kehadiran</p><strong>96%</strong><div className="score-row"><i><b style={{width:"96%"}} /></i><span>18 / 19 hari</span></div></article></div>
    <section className="panel student-history-panel"><div className="panel-heading"><div><h2>Riwayat terbaru</h2><p>Catatan presensimu minggu ini</p></div><button className="text-link" onClick={() => navigate("Riwayat saya")}>Lihat semua →</button></div><div className="history-list">{[["Rab, 19 Agu","06:38","14:16","Tepat waktu"],["Sel, 18 Agu","06:44","14:11","Tepat waktu"],["Sen, 17 Agu","06:51","14:08","Tepat waktu"],["Jum, 14 Agu","07:18","14:14","Terlambat"]].map(([date,cin,cout,status])=><div key={date}><time>{date}</time><span><b>↘</b>{cin}</span><span><b>↗</b>{cout}</span><StatusPill tone={status==="Terlambat"?"gold":"green"}>{status}</StatusPill></div>)}</div></section>
    {scanResult && <ScanResult onClose={() => setScanResult(false)} />}
  </>;
}

function StudentHistory() {
  return <><PageHeading eyebrow="AKUN SISWA · 10001" title="Riwayat saya" description="Catatan kehadiran pribadi untuk semester berjalan." action={<button className="outline-button">↓ Unduh</button>} /><div className="student-history-summary"><StatCard icon="✓" label="Hadir" value="18 hari" detail="Bulan ini" tone="green" /><StatCard icon="◷" label="Terlambat" value="1 hari" detail="5,3%" tone="gold" /><StatCard icon="—" label="Tidak hadir" value="0 hari" detail="Bulan ini" tone="red" /></div><section className="panel student-history-panel"><div className="panel-heading"><div><h2>Agustus 2026</h2><p>19 hari sekolah tercatat</p></div><select><option>Agustus 2026</option></select></div><div className="history-list expanded">{[["Kam, 20 Agustus","06:41","—","Tepat waktu"],["Rab, 19 Agustus","06:38","14:16","Tepat waktu"],["Sel, 18 Agustus","06:44","14:11","Tepat waktu"],["Sen, 17 Agustus","06:51","14:08","Tepat waktu"],["Jum, 14 Agustus","07:18","14:14","Terlambat"],["Kam, 13 Agustus","06:36","14:09","Tepat waktu"]].map(([date,cin,cout,status])=><div key={date}><time>{date}</time><span><b>↘</b>{cin}</span><span><b>↗</b>{cout}</span><StatusPill tone={status==="Terlambat"?"gold":"green"}>{status}</StatusPill></div>)}</div></section></>;
}

function ScanResult({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="scan-card"><div className="scan-success">✓<i /></div><p className="eyebrow dark">PRESENSI BERHASIL</p><h2>Kepulangan tercatat</h2><p>Sampai jumpa besok, Alya. Hati-hati di perjalanan.</p><div className="scan-detail"><span>JENIS<strong>Kepulangan</strong></span><span>WAKTU<strong>14:12 WIB</strong></span><span>METODE<strong>QR Code</strong></span></div><button className="primary-button" onClick={onClose}>Kembali ke beranda</button></div></div>;
}

export function AttendanceApp() {
  const [role, setRole] = useState<Role>("login");
  return role === "login" ? <LoginScreen onLogin={setRole} /> : <AppShell role={role} onLogout={() => setRole("login")} />;
}
