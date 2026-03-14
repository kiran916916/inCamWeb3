"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, Layers, BarChart2, Settings, Plus, Video, Image as ImageIcon, Music, FileText } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const STUDIO_TABS = [
  { id: "upload", label: "Upload", icon: Upload },
  { id: "content", label: "My Content", icon: Layers },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
  { id: "settings", label: "Settings", icon: Settings },
];

const ContentSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(["video", "image", "audio", "text"]),
  tier: z.enum(["freemium", "premium"]),
  accessMode: z.enum(["token_gated", "subscription", "pay_per_view"]).optional(),
  price: z.string().optional(),
  royaltyBps: z.number().min(200).max(1000).default(500),
  mintAsNFT: z.boolean().default(true),
});

type ContentFormData = z.infer<typeof ContentSchema>;

export function CreatorStudio() {
  const [activeTab, setActiveTab] = useState("upload");
  const [isDragging, setIsDragging] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ContentFormData>({
    resolver: zodResolver(ContentSchema),
    defaultValues: { type: "video", tier: "freemium", royaltyBps: 500, mintAsNFT: true },
  });

  const tier = watch("tier");

  const onSubmit = async (data: ContentFormData) => {
    // 1. Get pre-signed upload URL from content service
    // 2. Upload file to R2
    // 3. Create content record
    // 4. If mintAsNFT, initiate NFT minting
    console.log("Submitting content:", data);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold text-text-primary mb-2">Creator Studio</h1>
        <p className="text-text-secondary">Upload content, mint NFTs, and track your earnings</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-bg-surface rounded-xl p-1 border border-white/5 w-fit">
        {STUDIO_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-accent-primary text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "upload" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload area */}
          <div>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); }}
              className={`relative rounded-2xl border-2 border-dashed p-12 text-center transition-all cursor-pointer
                ${isDragging ? "border-accent-primary bg-accent-primary/10" : "border-white/20 hover:border-accent-primary/50 bg-bg-secondary"}
              `}
            >
              <Upload className="w-12 h-12 text-accent-primary mx-auto mb-4" />
              <h3 className="font-display font-bold text-lg text-text-primary mb-2">
                Drop your file here
              </h3>
              <p className="text-text-secondary text-sm mb-4">
                or click to browse — up to 2GB
              </p>
              <div className="flex justify-center gap-3 text-text-secondary text-sm">
                {[{ icon: Video, label: "Video" }, { icon: ImageIcon, label: "Image" }, { icon: Music, label: "Audio" }, { icon: FileText, label: "Text" }].map((t) => (
                  <span key={t.label} className="flex items-center gap-1">
                    <t.icon className="w-3.5 h-3.5" /> {t.label}
                  </span>
                ))}
              </div>
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="video/*,image/*,audio/*,.pdf,.txt" />
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Title *</label>
              <input {...register("title")} placeholder="Your content title" className="input-field" />
              {errors.title && <p className="text-brand-danger text-xs mt-1">{errors.title.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Description</label>
              <textarea {...register("description")} rows={3} placeholder="Describe your content..." className="input-field resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Content Type</label>
                <select {...register("type")} className="input-field">
                  <option value="video">Video</option>
                  <option value="image">Image</option>
                  <option value="audio">Audio</option>
                  <option value="text">Text / Article</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Tier</label>
                <select {...register("tier")} className="input-field">
                  <option value="freemium">Free</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
            </div>

            {tier === "premium" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="grid grid-cols-2 gap-4"
              >
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Access Mode</label>
                  <select {...register("accessMode")} className="input-field">
                    <option value="token_gated">Token Gated (hold NFTs)</option>
                    <option value="subscription">Subscription</option>
                    <option value="pay_per_view">Pay Per View</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Price (INCAM)</label>
                  <input {...register("price")} type="number" placeholder="0.00" className="input-field" />
                </div>
              </motion.div>
            )}

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Royalty on Secondary Sales: {((watch("royaltyBps") || 500) / 100).toFixed(1)}%
              </label>
              <input {...register("royaltyBps", { valueAsNumber: true })} type="range" min={200} max={1000} step={50} className="w-full accent-accent-primary" />
              <div className="flex justify-between text-xs text-text-secondary mt-1">
                <span>2% min</span><span>10% max</span>
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input {...register("mintAsNFT")} type="checkbox" className="w-4 h-4 accent-accent-primary" />
              <span className="text-sm text-text-secondary">Mint as NFT on Polygon <span className="text-accent-secondary text-xs">(gas sponsored)</span></span>
            </label>

            <button type="submit" className="btn-primary py-4 mt-2">
              <Plus className="w-4 h-4" /> Publish Content
            </button>
          </form>
        </div>
      )}

      {activeTab === "analytics" && (
        <div className="card p-8 text-center">
          <BarChart2 className="w-12 h-12 text-accent-primary mx-auto mb-4" />
          <h3 className="font-display text-xl font-bold text-text-primary mb-2">Analytics Dashboard</h3>
          <p className="text-text-secondary">Revenue breakdown, view counts, NFT trade history, and royalty earnings across all your content.</p>
        </div>
      )}
    </div>
  );
}
