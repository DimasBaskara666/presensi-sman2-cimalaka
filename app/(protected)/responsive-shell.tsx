"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  const links: NavLinkItem[] = [];

  if (hasCapability(role, "access_admin")) {
    links.push(
      { href: "/admin", label: "Ringkasan" },
      { href: "/admin/students", label: "Kelola Siswa" },
      { href: "/admin/teachers", label: "Kelola Guru" },
      { href: "/admin/attendance-qr", label: "QR Presensi" },
      { href: "/admin/attendance-settings", label: "Pengaturan Presensi" },
      { href: "/admin/attendance-corrections", label: "Koreksi Presensi" },
    );
  }

  if (hasCapability(role, "access_teacher_operations")) {
    links.push({ href: "/teacher", label: "Operasional Guru" });
  }

  if (hasCapability(role, "read_own_attendance")) {
    links.push(
      { href: "/student", label: "Beranda" },
      { href: "/student/scan", label: "Pindai QR" },
    );
  }

  if (hasCapability(role, "read_all_attendance") || hasCapability(role, "read_own_attendance")) {
    links.push({
      href: "/attendance/history",
      label: role === "student" ? "Riwayat" : "Riwayat Presensi",
    });
  }

  links.push({ href: "/change-password", label: "Ubah Kata Sandi" });
  return links;
}

function isLinkActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/admin") {
    return pathname === "/admin";
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
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const links = getNavLinks(person.role);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setDrawerOpen(false);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        toggleButtonRef.current?.focus();
        return;
      }

      if (event.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    if (drawerOpen) {
      window.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
      const timer = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("keydown", onKeyDown);
        document.body.style.overflow = "";
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [drawerOpen]);

  function handleCloseDrawer() {
    setDrawerOpen(false);
    toggleButtonRef.current?.focus();
  }

  return (
    <div className="shell">
      <a href="#main-content" className="sr-only-focusable">
        Lewati ke konten utama
      </a>

      {/* Mobile Topbar */}
      <header className="mobile-topbar" aria-label="Bilah navigasi ponsel">
        <button
          ref={toggleButtonRef}
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
        onClick={handleCloseDrawer}
        aria-hidden="true"
      />

      {/* Mobile Drawer */}
      <aside
        ref={drawerRef}
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
            ref={closeButtonRef}
            className="mobile-drawer-close"
            type="button"
            aria-label="Tutup menu navigasi"
            onClick={handleCloseDrawer}
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
                aria-current={active ? "page" : undefined}
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
                aria-current={active ? "page" : undefined}
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
      <main className={`content${person.role === "student" ? " content-with-bottom-nav" : ""}`} id="main-content">
        {children}
      </main>

      {/* Student Mobile Bottom Navigation (DESIGN.md Section 10 & 14) */}
      {person.role === "student" ? (
        <nav className="student-bottom-nav" aria-label="Navigasi bawah siswa">
          <Link
            href="/student"
            className={`student-bottom-nav-item${pathname === "/student" ? " is-active" : ""}`}
            aria-current={pathname === "/student" ? "page" : undefined}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Beranda</span>
          </Link>

          <Link
            href="/student/scan"
            className={`student-bottom-nav-item student-bottom-nav-scan${pathname === "/student/scan" ? " is-active" : ""}`}
            aria-current={pathname === "/student/scan" ? "page" : undefined}
          >
            <div className="student-bottom-nav-scan-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <circle cx="17.5" cy="17.5" r="2.5" />
              </svg>
            </div>
            <span>Pindai QR</span>
          </Link>

          <Link
            href="/attendance/history"
            className={`student-bottom-nav-item${pathname.startsWith("/attendance/history") ? " is-active" : ""}`}
            aria-current={pathname.startsWith("/attendance/history") ? "page" : undefined}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>Riwayat</span>
          </Link>

          <Link
            href="/change-password"
            className={`student-bottom-nav-item${pathname === "/change-password" ? " is-active" : ""}`}
            aria-current={pathname === "/change-password" ? "page" : undefined}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Sandi</span>
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
