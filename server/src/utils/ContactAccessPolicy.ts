export type RecruiterContactAccess = "VISIBLE" | "AFTER_APPLICATION";

type VacancyWithRecruiterContacts = {
  hrProfile: {
    links: unknown[];
    user: Record<string, unknown> & { email?: string | null };
  } | null;
};

type HrWithContacts = {
  links: unknown[];
  user: Record<string, unknown> & { email?: string | null };
};

/** Removes recruiter contact values from a student-facing vacancy until the student applies. */
export function applyVacancyRecruiterContactPolicy<T extends VacancyWithRecruiterContacts>(
  vacancy: T,
  contactsVisible: boolean,
) {
  return {
    ...vacancy,
    recruiterContactAccess: (contactsVisible ? "VISIBLE" : "AFTER_APPLICATION") as RecruiterContactAccess,
    hrProfile: vacancy.hrProfile
      ? {
          ...vacancy.hrProfile,
          links: contactsVisible ? vacancy.hrProfile.links : [],
          user: {
            ...vacancy.hrProfile.user,
            email: contactsVisible ? vacancy.hrProfile.user.email : null,
          },
        }
      : null,
  };
}

/** Removes a recruiter profile's contacts until the student applies to one of their vacancies. */
export function applyHrContactPolicy<T extends HrWithContacts>(
  hr: T,
  contactsVisible: boolean,
) {
  return {
    ...hr,
    contactAccess: (contactsVisible ? "VISIBLE" : "AFTER_APPLICATION") as RecruiterContactAccess,
    links: contactsVisible ? hr.links : [],
    user: {
      ...hr.user,
      email: contactsVisible ? hr.user.email : null,
    },
  };
}
