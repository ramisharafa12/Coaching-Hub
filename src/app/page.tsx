"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homeForRole, useAuth } from "@/components/AuthProvider";
import { Spinner } from "@/components/ui";

export default function Home() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !profile || profile.role === "none") router.replace("/login");
    else router.replace(homeForRole(profile.role));
  }, [user, profile, loading, router]);

  return <Spinner />;
}
