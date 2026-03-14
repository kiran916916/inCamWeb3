import { MarketplaceGrid } from "@/components/marketplace/MarketplaceGrid";
import { MarketplaceFilters } from "@/components/marketplace/MarketplaceFilters";

export const metadata = { title: "NFT Marketplace — InCam" };

export default function MarketplacePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold text-text-primary mb-2">NFT Marketplace</h1>
        <p className="text-text-secondary">Buy, sell, and collect creator NFTs with on-chain royalties</p>
      </div>
      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-64 flex-shrink-0">
          <MarketplaceFilters />
        </aside>
        <div className="flex-1">
          <MarketplaceGrid />
        </div>
      </div>
    </div>
  );
}
