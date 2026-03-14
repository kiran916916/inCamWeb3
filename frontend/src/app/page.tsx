import { HeroSection } from "@/components/landing/HeroSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { FeaturedCreators } from "@/components/landing/FeaturedCreators";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { NFTTicker } from "@/components/landing/NFTTicker";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <NFTTicker />
      <HeroSection />
      <StatsSection />
      <FeaturedCreators />
      <HowItWorks />
    </div>
  );
}
