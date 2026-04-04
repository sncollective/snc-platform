import { useState, useEffect } from "react";
import type React from "react";

import { apiGet, apiMutate } from "../../lib/fetch-utils.js";
import styles from "./follow-button.module.css";

// ── Public Types ──

export interface FollowButtonProps {
  readonly creatorId: string;
  readonly isAuthenticated: boolean;
}

// ── Public API ──

/** Follow/unfollow button for creator pages. Shows follower count. */
export function FollowButton({
  creatorId,
  isAuthenticated,
}: FollowButtonProps): React.ReactElement {
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await apiGet<{
          isFollowing: boolean;
          followerCount: number;
        }>(`/api/creators/${creatorId}/follow`);
        setIsFollowing(status.isFollowing);
        setFollowerCount(status.followerCount);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchStatus();
  }, [creatorId]);

  const handleToggle = async () => {
    if (!isAuthenticated || isToggling) return;

    setIsToggling(true);
    try {
      if (isFollowing) {
        await apiMutate(`/api/creators/${creatorId}/follow`, { method: "DELETE" });
        setIsFollowing(false);
        setFollowerCount((c) => Math.max(0, c - 1));
      } else {
        await apiMutate(`/api/creators/${creatorId}/follow`, { method: "POST" });
        setIsFollowing(true);
        setFollowerCount((c) => c + 1);
      }
    } finally {
      setIsToggling(false);
    }
  };

  if (isLoading) return <span className={styles.placeholder} />;

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={`${styles.button} ${isFollowing ? styles.following : ""}`}
        onClick={() => { void handleToggle(); }}
        disabled={!isAuthenticated || isToggling}
        title={isAuthenticated ? undefined : "Sign in to follow"}
      >
        {isFollowing ? "Following" : "Follow"}
      </button>
      {followerCount > 0 && (
        <span className={styles.count}>{followerCount}</span>
      )}
    </div>
  );
}
