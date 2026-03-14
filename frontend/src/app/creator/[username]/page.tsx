import { CreatorProfile } from "@/components/creator/CreatorProfile";

export async function generateMetadata({ params }: { params: { username: string } }) {
  return { title: `@${params.username} — InCam` };
}

export default function CreatorPage({ params }: { params: { username: string } }) {
  return <CreatorProfile username={params.username} />;
}
