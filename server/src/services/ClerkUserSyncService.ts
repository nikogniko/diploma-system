type ClerkCreateEmailAddressResponse = {
  id?: string;
};

export class ClerkUserSyncService {
  /** Створює новий email у Clerk і робить його primary, якщо налаштований CLERK_SECRET_KEY. */
  async setPrimaryEmail(clerkUserId: string, email: string) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) return { skipped: true };

    const response = await fetch("https://api.clerk.com/v1/email_addresses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: clerkUserId,
        email_address: email,
        primary: true,
        verified: false,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Failed to update Clerk email: ${details}`);
    }

    return (await response.json()) as ClerkCreateEmailAddressResponse;
  }

  /** Видаляє Clerk user, якщо локальна бізнес-логіка відхилила реєстрацію. */
  async deleteUser(clerkUserId: string) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) return { skipped: true };

    const response = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Failed to delete Clerk user: ${details}`);
    }

    return { deleted: true };
  }
}

export const clerkUserSyncService = new ClerkUserSyncService();
