import { ContentFeed } from "@/components/feed/ContentFeed";

export const metadata = { title: "Feed — InCam" };

export default function FeedPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-display text-4xl font-bold text-text-primary mb-2">Content Feed</h1>
      <p className="text-text-secondary mb-8">Discover content from creators you love</p>
      <ContentFeed />
    </div>
  );
}
