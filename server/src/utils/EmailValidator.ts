export class EmailValidator {
  private static readonly ACADEMIC_DOMAINS = ["edu.ua", "kpi.ua", "knu.ua"];

  public static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  public static extractDomain(email: string): string {
    const normalizedEmail = this.normalizeEmail(email);
    const parts = normalizedEmail.split("@");

    return parts.length === 2 ? parts[1] : "";
  }

  private static normalizeDomain(domain: string): string {
    return domain.trim().toLowerCase().replace(/^@/, "");
  }

  private static isDomainMatch(
    userDomain: string,
    targetDomain: string,
  ): boolean {
    const normalizedTargetDomain = this.normalizeDomain(targetDomain);

    return (
      userDomain === normalizedTargetDomain ||
      userDomain.endsWith(`.${normalizedTargetDomain}`)
    );
  }

  public static isAcademic(email: string): boolean {
    const domain = this.extractDomain(email);
    if (!domain) return false;

    return this.ACADEMIC_DOMAINS.some((academicDomain) =>
      this.isDomainMatch(domain, academicDomain),
    );
  }

  public static isValidRecruiterDomain(
    email: string,
    companyDomain?: string | null,
  ): boolean {
    if (!companyDomain) return true;

    const userDomain = this.extractDomain(email);
    if (!userDomain) return false;

    return this.isDomainMatch(userDomain, companyDomain);
  }
}
