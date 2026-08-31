import "server-only";
import {
  digestActivationCode,
  generateActivationCode,
} from "@/lib/auth/activation-code";
import {
  getActivationCodePepper,
  getActivationCodeTtlHours,
} from "@/lib/auth/server-config";
import {
  StudentActivationError,
} from "@/lib/auth/student-activation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  compareClassNames,
  type BulkActivationSlip,
  type BulkActivationStats,
  type ClassActivationBreakdown,
  type PrepareBulkActivationOptions,
} from "./student-activation-model";

export * from "./student-activation-model";

export async function getBulkActivationStats(): Promise<BulkActivationStats> {
  const admin = createAdminClient();
  const pageSize = 1000;
  type StudentRow = {
    login_id: string;
    class_name: string | null;
    is_active: boolean;
    auth_user_id: string | null;
    claim_code_digest: string | null;
  };
  const allStudents: StudentRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("people")
      .select("login_id, class_name, is_active, auth_user_id, claim_code_digest")
      .eq("role", "student")
      .order("login_id")
      .range(from, from + pageSize - 1);

    if (error || !data) {
      throw new StudentActivationError("bulk_prepare_failed");
    }
    allStudents.push(...data);
    if (data.length < pageSize) break;
  }

  let activatedCount = 0;
  let hasCodeCount = 0;
  let needsCodeCount = 0;

  const classMap = new Map<string, { total: number; activated: number; hasCode: number; needsCode: number }>();

  for (const student of allStudents) {
    const className = (student.class_name ?? "").trim() || "Tanpa Kelas";
    let entry = classMap.get(className);
    if (!entry) {
      entry = { total: 0, activated: 0, hasCode: 0, needsCode: 0 };
      classMap.set(className, entry);
    }
    entry.total += 1;

    if (student.auth_user_id !== null) {
      activatedCount += 1;
      entry.activated += 1;
    } else if (student.claim_code_digest !== null) {
      hasCodeCount += 1;
      entry.hasCode += 1;
    } else if (student.is_active) {
      needsCodeCount += 1;
      entry.needsCode += 1;
    }
  }

  const sortedClasses = Array.from(classMap.keys()).sort(compareClassNames);
  const classBreakdown: ClassActivationBreakdown[] = sortedClasses.map((className) => {
    const counts = classMap.get(className)!;
    return {
      className,
      total: counts.total,
      activated: counts.activated,
      hasCode: counts.hasCode,
      needsCode: counts.needsCode,
    };
  });

  return {
    totalStudents: allStudents.length,
    activatedCount,
    hasCodeCount,
    needsCodeCount,
    classes: sortedClasses,
    classBreakdown,
  };
}

export async function prepareBulkStudentActivations(
  options: PrepareBulkActivationOptions = {},
): Promise<BulkActivationSlip[]> {
  const admin = createAdminClient();
  const normalizedClass = options.className?.trim();
  const regenerateAll = Boolean(options.regenerateAll);

  let query = admin
    .from("people")
    .select("login_id, full_name, class_name, is_active, auth_user_id, claimed_at, claim_code_digest")
    .eq("role", "student")
    .eq("is_active", true)
    .is("auth_user_id", null)
    .is("claimed_at", null);

  if (normalizedClass) {
    query = query.eq("class_name", normalizedClass);
  }

  if (!regenerateAll) {
    query = query.is("claim_code_digest", null);
  }

  const { data: candidates, error: fetchError } = await query;
  if (fetchError || !candidates) {
    throw new StudentActivationError("bulk_prepare_failed");
  }

  if (candidates.length === 0) {
    return [];
  }

  const ttlHours = getActivationCodeTtlHours();
  const pepper = getActivationCodePepper();
  const now = new Date();

  const rpcItems: Array<{ login_id: string; claim_code_digest: string }> = [];
  const slips: BulkActivationSlip[] = [];

  for (const student of candidates) {
    const generated = generateActivationCode(ttlHours, now);
    const digest = digestActivationCode(generated.code, pepper);

    rpcItems.push({
      login_id: student.login_id,
      claim_code_digest: digest,
    });

    slips.push({
      loginId: student.login_id,
      fullName: student.full_name,
      className: student.class_name ?? "",
      activationCode: generated.code,
      expiresAt: generated.expiresAt,
    });
  }

  const { data: updatedCount, error: rpcError } = await admin.rpc(
    "prepare_bulk_student_activations",
    { p_items: rpcItems },
  );

  if (rpcError || typeof updatedCount !== "number" || updatedCount <= 0) {
    throw new StudentActivationError("bulk_prepare_failed");
  }

  slips.sort((a, b) => {
    const classDiff = compareClassNames(a.className, b.className);
    if (classDiff !== 0) return classDiff;
    return a.fullName.localeCompare(b.fullName, "id-ID", { sensitivity: "base" });
  });

  return slips;
}
