"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const CONTENT_TYPES = ["All", "Video", "Image", "Audio", "Text"];
const CATEGORIES = ["All", "Art", "Music", "Gaming", "Sports", "Education", "Comedy"];

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function FilterSection({ title, children, defaultOpen = true }: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/5 pb-4 mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full text-sm font-semibold text-text-primary mb-3"
      >
        {title}
        <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

export function MarketplaceFilters() {
  const [contentType, setContentType] = useState("All");
  const [category, setCategory] = useState("All");
  const [tier, setTier] = useState<"all" | "freemium" | "premium">("all");
  const [listingType, setListingType] = useState<"all" | "fixed" | "auction">("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  return (
    <div className="card p-4">
      <h2 className="font-display font-bold text-text-primary mb-6">Filters</h2>

      <FilterSection title="Content Type">
        <div className="flex flex-wrap gap-2">
          {CONTENT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setContentType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                contentType === type
                  ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/30"
                  : "bg-bg-secondary text-text-secondary border border-white/10 hover:border-white/20"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Tier">
        <div className="flex flex-col gap-2">
          {[
            { value: "all", label: "All" },
            { value: "freemium", label: "Free" },
            { value: "premium", label: "Premium" },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="tier"
                value={opt.value}
                checked={tier === opt.value}
                onChange={() => setTier(opt.value as typeof tier)}
                className="accent-accent-primary"
              />
              <span className="text-sm text-text-secondary">{opt.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Listing Type">
        <div className="flex flex-col gap-2">
          {[
            { value: "all", label: "All" },
            { value: "fixed", label: "Fixed Price" },
            { value: "auction", label: "Auction" },
          ].map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="listingType"
                value={opt.value}
                checked={listingType === opt.value}
                onChange={() => setListingType(opt.value as typeof listingType)}
                className="accent-accent-primary"
              />
              <span className="text-sm text-text-secondary">{opt.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Price Range (INCAM)">
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="input-field py-2 text-sm"
          />
          <span className="text-text-secondary">—</span>
          <input
            type="number"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="input-field py-2 text-sm"
          />
        </div>
      </FilterSection>

      <FilterSection title="Category">
        <div className="flex flex-col gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                category === cat
                  ? "bg-accent-primary/10 text-accent-primary"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </FilterSection>

      <button className="btn-secondary w-full text-sm">Apply Filters</button>
    </div>
  );
}
