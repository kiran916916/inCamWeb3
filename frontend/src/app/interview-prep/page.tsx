import { InterviewPrepTutorial } from "@/components/interview/InterviewPrepTutorial";

export const metadata = {
  title: "Coding Interview Prep — InCam",
  description: "Master coding interviews with confidence. Learn the UMPIRE framework, problem-solving patterns, and how to impress your interviewer.",
};

export default function InterviewPrepPage() {
  return (
    <div className="min-h-screen">
      <InterviewPrepTutorial />
    </div>
  );
}
