import { useAuth, useUser } from "@clerk/react";
import { useEffect, useRef } from "react";
import { apiRequest } from "../../api/apiClient";

/** Keeps Clerk-managed profile fields that the UI reads from the DB in sync. */
export function ClerkProfileSync() {
  const { getToken } = useAuth();
  const { isLoaded, isSignedIn, user } = useUser();
  const lastSyncedValue = useRef<string | null>(null);
  const role = user?.publicMetadata?.role as string | undefined;

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id || !role) return;

    const photoUrl = user.imageUrl || null;
    const syncKey = `${user.id}:${photoUrl ?? ""}`;
    if (lastSyncedValue.current === syncKey) return;

    lastSyncedValue.current = syncKey;
    void getToken()
      .then((token) =>
        apiRequest("/users/my-cabinet/photo", token, {
          method: "PATCH",
          body: JSON.stringify({ photoUrl }),
        }),
      )
      .catch(() => {
        lastSyncedValue.current = null;
      });
  }, [getToken, isLoaded, isSignedIn, role, user?.id, user?.imageUrl]);

  return null;
}
