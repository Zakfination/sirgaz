"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthProvider } from "../../authContext";
import { RedeemReward } from "../../screens_extra";

const Redeem = () => {
  const { code } = useParams();
  const router = useRouter();
  return (
    <div className="min-h-screen w-full bg-black flex items-center justify-center py-6 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-[#FF2F92]/15 blur-[120px]"/>
        <div className="absolute bottom-0 left-1/3 w-[520px] h-[520px] rounded-full bg-[#00E5FF]/10 blur-[120px]"/>
      </div>
      <div className="relative w-full max-w-[430px] min-h-[100dvh] md:min-h-[860px] md:h-[860px] md:max-h-[860px] md:rounded-[52px] overflow-hidden bg-black md:border md:border-white/10 md:shadow-[0_40px_120px_-20px_rgba(255,47,146,0.35)]">
        <RedeemReward code={code} onDone={() => router.push("/")}/>
      </div>
    </div>
  );
};

export default function Page() {
  return <AuthProvider><Redeem/></AuthProvider>;
}
