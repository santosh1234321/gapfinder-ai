"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LogoutButton from "@/app/dashboard/logout-button";

export default function DashboardPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? "");
      setLoading(false);
    };

    checkUser();
  }, [router]);

  if (loading) {
    return <p>Loading your dashboard...</p>;
  }

  return (
    <main>
      <h1>Welcome to GapFinder AI!</h1>
      <p>You are successfully logged in.</p>
      <p>Email: {email}</p>
      <LogoutButton />
    </main>
  );
}