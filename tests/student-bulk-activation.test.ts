import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  digestActivationCode,
  evaluateClaimEligibility,
  generateActivationCode,
  readActivationCodeExpiry,
  verifyUnexpiredActivationCode,
} from "../lib/auth/activation-code";
import {
  compareClassNames,
  type BulkActivationSlip,
} from "../lib/students/student-activation-model";
import {
  generateStudentActivationPdf,
} from "../lib/students/student-activation-pdf";

test("compareClassNames naturally orders grade levels and section numbers", () => {
  const unsorted = [
    "12.6",
    "10.10",
    "11.1",
    "10.1",
    "12.1",
    "10.2",
    "10.7",
    "11.6",
    "11.2",
    "12.2",
  ];

  const sorted = [...unsorted].sort(compareClassNames);
  assert.deepEqual(sorted, [
    "10.1",
    "10.2",
    "10.7",
    "10.10",
    "11.1",
    "11.2",
    "11.6",
    "12.1",
    "12.2",
    "12.6",
  ]);
});

test("compareClassNames correctly sorts all 19 real school class sections", () => {
  const schoolClasses = [
    "12.5", "11.3", "10.4", "12.1", "10.7", "11.6", "10.1", "12.6",
    "11.1", "10.5", "12.2", "11.4", "10.2", "12.4", "11.2", "10.6",
    "12.3", "11.5", "10.3",
  ];

  const sorted = [...schoolClasses].sort(compareClassNames);
  const expected = [
    "10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "10.7",
    "11.1", "11.2", "11.3", "11.4", "11.5", "11.6",
    "12.1", "12.2", "12.3", "12.4", "12.5", "12.6",
  ];

  assert.deepEqual(sorted, expected);
});

test("bulk activation generation creates 676 unique, valid tokens with HMAC digests", () => {
  const count = 676;
  const pepper = "test-activation-pepper-bulk";
  const now = new Date();
  const ttlHours = 720; // 30 days

  const codes = new Set<string>();
  const digests = new Set<string>();

  for (let i = 0; i < count; i += 1) {
    const { code, expiresAt } = generateActivationCode(ttlHours, now);
    assert.match(code, /^A1-[0-9A-Z]+-[A-F0-9]{32}$/);
    codes.add(code);

    const expiry = readActivationCodeExpiry(code);
    assert.ok(expiry !== null);
    assert.equal(expiry.toISOString(), expiresAt);

    const digest = digestActivationCode(code, pepper);
    assert.match(digest, /^[a-f0-9]{64}$/);
    digests.add(digest);

    assert.equal(verifyUnexpiredActivationCode(code, digest, pepper, now), true);
  }

  assert.equal(codes.size, count, "All 676 activation codes must be unique");
  assert.equal(digests.size, count, "All 676 HMAC digests must be unique");
});

test("bulk candidate eligibility filters inactive, claimed, and existing codes according to mode", () => {
  type TestStudent = {
    loginId: string;
    isActive: boolean;
    authUserId: string | null;
    claimedAt: string | null;
    claimCodeDigest: string | null;
    className: string;
  };

  const roster: TestStudent[] = [
    // 1. Eligible, needs code
    { loginId: "S001", isActive: true, authUserId: null, claimedAt: null, claimCodeDigest: null, className: "10.1" },
    // 2. Inactive student -> must be skipped
    { loginId: "S002", isActive: false, authUserId: null, claimedAt: null, claimCodeDigest: null, className: "10.1" },
    // 3. Already claimed/activated -> must be skipped
    { loginId: "S003", isActive: true, authUserId: "auth-123", claimedAt: "2026-08-30", claimCodeDigest: null, className: "10.1" },
    // 4. Has existing code (unclaimed)
    { loginId: "S004", isActive: true, authUserId: null, claimedAt: null, claimCodeDigest: "existing-digest", className: "10.1" },
    // 5. Eligible in class 10.2
    { loginId: "S005", isActive: true, authUserId: null, claimedAt: null, claimCodeDigest: null, className: "10.2" },
  ];

  // Mode 1: Safe default (regenerateAll = false, no class filter) -> only S001 and S005
  const defaultEligible = roster.filter(
    (s) => s.isActive && s.authUserId === null && s.claimedAt === null && s.claimCodeDigest === null,
  );
  assert.deepEqual(defaultEligible.map((s) => s.loginId), ["S001", "S005"]);

  // Mode 2: Safe default with class 10.1 filter -> only S001
  const classFiltered = defaultEligible.filter((s) => s.className === "10.1");
  assert.deepEqual(classFiltered.map((s) => s.loginId), ["S001"]);

  // Mode 3: Explicit regenerateAll = true for class 10.1 -> S001 and S004 (S002 inactive and S003 activated are still skipped)
  const regenerateEligible = roster.filter(
    (s) => s.isActive && s.authUserId === null && s.claimedAt === null && s.className === "10.1",
  );
  assert.deepEqual(regenerateEligible.map((s) => s.loginId), ["S001", "S004"]);
});

test("activation code lifecycle: regeneration invalidates previous digest and single-use claiming consumes it", () => {
  const pepper = "lifecycle-test-pepper";
  const now = new Date();

  // 1. Initial code generation
  const first = generateActivationCode(720, now);
  const firstDigest = digestActivationCode(first.code, pepper);
  assert.equal(verifyUnexpiredActivationCode(first.code, firstDigest, pepper, now), true);

  // 2. Regeneration: new code is issued, old code is invalidated
  const second = generateActivationCode(720, now);
  const secondDigest = digestActivationCode(second.code, pepper);
  assert.notEqual(first.code, second.code);
  assert.notEqual(firstDigest, secondDigest);

  // Old code no longer matches new digest
  assert.equal(verifyUnexpiredActivationCode(first.code, secondDigest, pepper, now), false);
  // New code matches new digest
  assert.equal(verifyUnexpiredActivationCode(second.code, secondDigest, pepper, now), true);

  // 3. Claiming account: claim_code_digest becomes null
  const claimedState = evaluateClaimEligibility({
    role: "student",
    authUserId: "auth-uuid-999",
    claimedAt: now.toISOString(),
    claimCodeDigest: null,
    isActive: true,
  });
  assert.equal(claimedState, "already_claimed");
});

test("activation PDF generation builds a valid PDF with class grouping and pagination", async () => {
  const syntheticSlips: BulkActivationSlip[] = [];
  const classes = ["10.1", "10.2", "11.1", "12.1"];

  for (const className of classes) {
    for (let s = 1; s <= 12; s += 1) {
      syntheticSlips.push({
        loginId: `2425${className.replace(".", "")}${String(s).padStart(3, "0")}`,
        fullName: `Siswa ${className} Nomor ${s}`,
        className,
        activationCode: `A1-EXPIRY-${String(s).padStart(32, "A")}`,
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      });
    }
  }

  const pdfBuffer = await generateStudentActivationPdf({
    slips: syntheticSlips,
    activationUrl: "https://presensi.sman2cimalaka.sch.id/activate",
    generatedAt: new Date(),
  });

  assert.ok(pdfBuffer instanceof Buffer);
  assert.ok(pdfBuffer.length > 1000, "PDF buffer must not be empty");
  assert.equal(pdfBuffer.subarray(0, 5).toString("ascii"), "%PDF-");
});

test("activation PDF generation handles empty slips gracefully", async () => {
  const pdfBuffer = await generateStudentActivationPdf({
    slips: [],
    activationUrl: "https://presensi.sman2cimalaka.sch.id/activate",
    generatedAt: new Date(),
    filteredClass: "10.1",
  });

  assert.ok(pdfBuffer instanceof Buffer);
  assert.ok(pdfBuffer.length > 500);
  assert.equal(pdfBuffer.subarray(0, 5).toString("ascii"), "%PDF-");
});

test("activation PDF handles multi-page continuation for large classes", async () => {
  const largeClassSlips: BulkActivationSlip[] = [];
  for (let s = 1; s <= 36; s += 1) {
    largeClassSlips.push({
      loginId: `2425101${String(s).padStart(3, "0")}`,
      fullName: `Murid Kelas Sepuluh Satu ${s}`,
      className: "10.1",
      activationCode: `A1-TOKEN-${String(s).padStart(32, "F")}`,
      expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    });
  }

  const pdfBuffer = await generateStudentActivationPdf({
    slips: largeClassSlips,
    activationUrl: "https://presensi.sman2cimalaka.sch.id/activate",
    generatedAt: new Date(),
    filteredClass: "10.1",
  });

  assert.ok(pdfBuffer instanceof Buffer);
  assert.ok(pdfBuffer.length > 2000);
  assert.equal(pdfBuffer.subarray(0, 5).toString("ascii"), "%PDF-");
});

test("bulk activation migration is atomic, security definer, and restricted to service_role", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/20260827000000_bulk_student_activation.sql", import.meta.url),
    "utf8",
  );

  assert.match(sql, /create function public\.prepare_bulk_student_activations/);
  assert.match(sql, /security definer\s+set search_path = ''/);
  assert.match(sql, /p\.role = 'student'/);
  assert.match(sql, /p\.is_active/);
  assert.match(sql, /p\.auth_user_id is null/);
  assert.match(sql, /p\.claimed_at is null/);
  assert.match(sql, /revoke all on function public\.prepare_bulk_student_activations\(jsonb\) from public/);
  assert.match(sql, /revoke all on function public\.prepare_bulk_student_activations\(jsonb\) from authenticated/);
  assert.match(sql, /grant execute on function public\.prepare_bulk_student_activations\(jsonb\) to service_role/);
  assert.doesNotMatch(sql, /grant [^;]+ to anon|disable row level security|grant all/i);
});

test("bulk activation routes and UI enforce admin role protection and server-side secret boundaries", async () => {
  const pdfRoute = await readFile(
    new URL("../app/(protected)/admin/students/activation-bulk/pdf/route.ts", import.meta.url),
    "utf8",
  );
  const bulkPage = await readFile(
    new URL("../app/(protected)/admin/students/activation-bulk/page.tsx", import.meta.url),
    "utf8",
  );
  const bulkService = await readFile(
    new URL("../lib/students/student-activation-bulk.ts", import.meta.url),
    "utf8",
  );

  assert.match(pdfRoute, /person\.role !== "admin"/);
  assert.match(pdfRoute, /prepareBulkStudentActivations\(\{/);
  assert.match(bulkPage, /requireCurrentPerson\(\{ allowedRoles: \["admin"\] \}\)/);
  assert.match(bulkService, /^import "server-only";/);
  assert.doesNotMatch(bulkPage, /SUPABASE_SERVICE_ROLE_KEY|ACTIVATION_CODE_PEPPER/);
  assert.doesNotMatch(pdfRoute, /console\./);
});

test("activation PDF matches attendance report visual design and layout conventions", async () => {
  const pdfSource = await readFile(
    new URL("../lib/students/student-activation-pdf.ts", import.meta.url),
    "utf8",
  );

  assert.match(pdfSource, /layout:\s*"landscape"/);
  assert.match(pdfSource, /size:\s*"A4"/);
  assert.match(pdfSource, /MARGIN\s*=\s*36/);
  assert.match(pdfSource, /TABLE_HEADER_HEIGHT\s*=\s*23/);
  assert.match(pdfSource, /TABLE_ROW_HEIGHT\s*=\s*24/);
  assert.match(pdfSource, /#126b51/);
  assert.match(pdfSource, /#eef6f3/);
  assert.match(pdfSource, /#d9e4df/);
  assert.match(pdfSource, /#17231f/);
  assert.match(pdfSource, /#60706a/);
  assert.match(pdfSource, /doc\.bufferedPageRange\(\)/);
  assert.match(pdfSource, /Sistem Presensi Sekolah \| Halaman/);
});

