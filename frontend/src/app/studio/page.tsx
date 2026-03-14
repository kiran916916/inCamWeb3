"use client";

import { useAuth } from "@/lib/auth/AuthProvider";
import { CreatorStudio } from "@/components/studio/CreatorStudio";
import { redirect } from "next/navigation";

export default function StudioPage() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    redirect("/");
  }

  if (user?.role === "VIEWER") {
    // Show upgrade prompt
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-6">🎬</div>
        <h1 className="font-display text-3xl font-bold text-text-primary mb-4">Become a Creator</h1>
        <p className="text-text-secondary mb-8">
          Apply to become a creator to unlock the Studio, start minting content NFTs, and earn royalties.
        </p>
        <button className="btn-primary px-8 py-4">Apply to Create</button>
      </div>
    );
  }

  return <CreatorStudio />;
}
