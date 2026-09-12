"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SchoolLogo } from "@/components/school-logo";
import { logoutAction } from "@/app/logout-action";
import { hasCapability } from "@/lib/auth/permissions";
import type { CurrentPerson } from "@/lib/auth/types";

const roleLabels = {
  admin: "Administrator",
  teacher: "Guru",
  student: "Siswa",
} as const;

type NavLinkItem = {
  href: string;
  label: string;
};

function getNavLinks(role: CurrentPerson["role"]): NavLinkItem[] {
  const links: NavLinkItem[] = [
    { href: "/dashboard", label: "Ringkasan" },
  ];

  if (hasCapability(role, "access_admin")) {
    links.push(
      { href: "/admin", label: "Administrasi" },
      { href: "/admin/attendance-qr", label: "QR Presensi" },
    );
  }

  if (hasCapability(role, "access_teacher_operations")) {
    links.push({ href: "/teacher", label: "Operasional Guru" });
  }

  if (hasCapability(role, "read_own_attendance")) {
    links.push(
      { href: "/student", label: "Akun Siswa" },
      { href: "/student/scan", label: "Scan QR" },
    );
  }

  if (hasCapability(role, "read_all_attendance") || hasCapability(role, "read_own_attendance")) {
    links.push({ href: "/attendance/history", label: "Riwayat Presensi" });
  }

  links.push({ href: "/change-password", label: "Ubah Kata Sandi" });
  return links;
}

function isLinkActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/dashboard") return false;
  if (href === "/admin") {
    return pathname.startsWith("/admin") && !pathname.startsWith("/admin/attendance-qr");
  }
  if (href === "/student") {
    return pathname.startsWith("/student") && !pathname.startsWith("/student/scan");
  }
  return pathname.startsWith(href + "/");
}

export function ResponsiveShell({
  person,
  children,
}: {
  person: CurrentPerson;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const links = getNavLinks(person.role);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setDrawerOpen(false);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    if (drawerOpen) {
      window.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="shell">
      {/* Mobile Topbar */}
      <header className="mobile-topbar" aria-label="Bilah navigasi ponsel">
        <button
          className="mobile-menu-toggle"
          type="button"
          aria-label={drawerOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
          aria-expanded={drawerOpen}
          aria-controls="mobile-nav-drawer"
          onClick={() => setDrawerOpen((prev) => !prev)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="mobile-topbar-brand">
          <SchoolLogo variant="color" height={28} alt="SMAN 2 Cimalaka" />
          <span className="mobile-topbar-title">Presensi SMAN 2</span>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      <div
        className={`mobile-drawer-backdrop${drawerOpen ? " is-open" : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile Drawer */}
      <aside
        id="mobile-nav-drawer"
        className={`mobile-drawer${drawerOpen ? " is-open" : ""}`}
        aria-label="Menu navigasi ponsel"
        aria-hidden={!drawerOpen}
      >
        <div className="mobile-drawer-header">
          <div className="sidebar-brand">
            <SchoolLogo variant="color" height={32} alt="SMAN 2 Cimalaka" />
            <div>
              <span className="mobile-drawer-school">SMAN 2 Cimalaka</span>
              <span className="mobile-drawer-app">Sistem Presensi</span>
            </div>
          </div>
          <button
            className="mobile-drawer-close"
            type="button"
            aria-label="Tutup menu navigasi"
            onClick={() => setDrawerOpen(false)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="nav-list" aria-label="Navigasi ponsel">
          {links.map((link) => {
            const active = isLinkActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                className={`nav-link${active ? " is-active" : ""}`}
                href={link.href}
                onClick={() => setDrawerOpen(false)}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <p><strong>{person.fullName}</strong></p>
          <p className="muted">{person.loginId} · {roleLabels[person.role]}</p>
          <form action={logoutAction}>
            <button className="button button-quiet" type="submit">Keluar</button>
          </form>
        </div>
      </aside>

      {/* Desktop Permanent Sidebar */}
      <aside className="sidebar desktop-sidebar" aria-label="Navigasi samping">
        <div className="sidebar-brand">
          <SchoolLogo variant="color" height={36} alt="SMAN 2 Cimalaka" />
          <div>
            <span className="sidebar-brand-name">SMAN 2 Cimalaka</span>
            <span className="sidebar-brand-sub">Sistem Presensi</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Navigasi utama">
          {links.map((link) => {
            const active = isLinkActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                className={`nav-link${active ? " is-active" : ""}`}
                href={link.href}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <p><strong>{person.fullName}</strong></p>
          <p className="muted">{person.loginId} · {roleLabels[person.role]}</p>
          <form action={logoutAction}>
            <button className="button button-quiet" type="submit">Keluar</button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="content">{children}</main>
    </div>
  );
}
