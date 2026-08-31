export type BulkActivationSlip = {
  loginId: string;
  fullName: string;
  className: string;
  activationCode: string;
  expiresAt: string;
};

export type ClassActivationBreakdown = {
  className: string;
  total: number;
  activated: number;
  hasCode: number;
  needsCode: number;
};

export type BulkActivationStats = {
  totalStudents: number;
  activatedCount: number;
  hasCodeCount: number;
  needsCodeCount: number;
  classes: string[];
  classBreakdown: ClassActivationBreakdown[];
};

export type PrepareBulkActivationOptions = {
  className?: string;
  regenerateAll?: boolean;
};

export function compareClassNames(a: string, b: string): number {
  const parseClass = (name: string) => {
    const trimmed = name.trim();
    const match = trimmed.match(/^(\d+)(?:\.(\d+))?(.*)$/);
    if (match) {
      return {
        grade: Number.parseInt(match[1], 10),
        section: match[2] ? Number.parseInt(match[2], 10) : 0,
        rest: match[3] ?? "",
      };
    }
    return { grade: 999, section: 999, rest: trimmed };
  };

  const parsedA = parseClass(a);
  const parsedB = parseClass(b);
  if (parsedA.grade !== parsedB.grade) return parsedA.grade - parsedB.grade;
  if (parsedA.section !== parsedB.section) return parsedA.section - parsedB.section;
  return a.localeCompare(b, "id-ID", { numeric: true, sensitivity: "base" });
}
