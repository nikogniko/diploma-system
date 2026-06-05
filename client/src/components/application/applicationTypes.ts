export type ApplicationStatus =
  | "SENT"
  | "VIEWED"
  | "SHORTLISTED"
  | "INTERVIEW_INVITED"
  | "OFFERED"
  | "HIRED"
  | "REJECTED"
  | "WITHDRAWN";

export type ApplicationHistoryItem = {
  id: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  createdAt: string;
  changedByUser?: {
    firstName?: string | null;
    lastName?: string | null;
    middleName?: string | null;
  } | null;
};

export type MatchSkill = { id: number; name: string };

export type MatchRequirementItem = {
  key: string;
  label: string;
  category: string;
  weight: number;
  matched: boolean;
  isBlocking: boolean;
  blockingReason: string | null;
  details?: Record<string, unknown>;
};

export type ApplicationMatchDetails = {
  score: number;
  baseRequirementsPercent: number;
  detailedScore: {
    skillDepthScore: number;
    additionalCriteriaScore: number;
    totalScore: number;
  };
  explanation: {
    summary: string;
    strongestAreas: string[];
    weakestAreas: Array<{ code: string; label: string | null }>;
    recommendation: string;
  };
  matchedCriticalSkills: MatchSkill[];
  missingCriticalSkills: MatchSkill[];
  matchedImportantSkills: MatchSkill[];
  missingImportantSkills: MatchSkill[];
  matchedPlusSkills: MatchSkill[];
  missingPlusSkills: MatchSkill[];
  missingLanguages: Array<{ name: string; requiredLevel: string; currentLevel: string | null }>;
  locationMismatch: boolean;
  requirementEligibility?: {
    matchesBlockingRequirements: boolean;
    blockingReasons: string[];
    missingBlockingRequirements: MatchRequirementItem[];
  };
  details: {
    baseRequirements: {
      totalRequirementsCount: number;
      matchedRequirementsCount: number;
      maxRequirementScore: number;
      matchedRequirementScore: number;
      baseRequirementsPercent: number;
      blockingRequirements: { totalCount: number; matchedCount: number; percent: number };
      items: MatchRequirementItem[];
    };
    skillBreakdown: Array<{
      skillId: number;
      skillName: string;
      vacancyWeight: number;
      requirementWeight: string;
      sourceSum: number;
      coursePoints: number;
      projectPoints: number;
      experiencePoints: number;
      skillScore: number;
      sources: {
        courses: Array<{ id: string; title: string; points: number }>;
        projects: Array<{ id: string; title: string; points: number }>;
        experiences: Array<{ id: string; position: string; companyName: string; months: number; points: number }>;
      };
    }>;
    languageBreakdown: Array<{
      languageName: string;
      requiredLevel: string;
      studentLevel: string | null;
      languageBonus: number;
    }>;
    locationBreakdown: { matchType: string; locationBonus: number; bonusRule?: string };
    educationBreakdown: { highestDegree: string | null; educationBonus: number };
    activeSearchBonus: number;
  };
};

export type ApplicationRecord = {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  matchScore: number | null;
  matchDetails?: ApplicationMatchDetails | null;
  vacancy: {
    id: string;
    title: string;
    status: string;
    company?: { publicName?: string | null; logoUrl?: string | null } | null;
  };
  studentProfile?: {
    desiredPosition?: string | null;
    user: {
      firstName?: string | null;
      lastName?: string | null;
      middleName?: string | null;
      photoUrl?: string | null;
    };
  };
  statusHistory: ApplicationHistoryItem[];
};

export type ApplicationResumeResponse<TProfile> = {
  contactAccess: "VISIBLE" | "AFTER_INTERVIEW_INVITE" | "HIDDEN";
  profile: TProfile;
};
