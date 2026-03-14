"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Target,
  Code2,
  Lightbulb,
  Trophy,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Zap,
  MessageSquare,
  Clock,
  Shield,
  TrendingUp,
  BookOpen,
  Star,
} from "lucide-react";
import { CodeBlock } from "./CodeBlock";

// ─── Data ────────────────────────────────────────────────────────────────────

const UMPIRE_STEPS = [
  {
    letter: "U",
    word: "Understand",
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/30",
    description: "Fully understand the problem before writing a single line of code.",
    tips: [
      "Read the problem twice — slowly.",
      'Ask: "What is the expected input and output?"',
      "Clarify edge cases: empty input, negative numbers, huge input sizes.",
      "Restate the problem in your own words to the interviewer.",
      'Ask: "Can I assume the input is always valid?"',
    ],
    example: 'Problem: "Find the two numbers in an array that add up to a target."\nYou say: "So I\'m given an integer array and a target sum. I need to return the indices of the two numbers that add up to that target. There\'s exactly one solution, and I can\'t reuse the same element. Is that right?"',
  },
  {
    letter: "M",
    word: "Match",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/30",
    description: "Match the problem to a known pattern or data structure.",
    tips: [
      "Two Sum / pairing → Hash Map",
      "Sliding window → Subarray / substring problems",
      "BFS → Shortest path, level-order traversal",
      "DFS → Tree paths, backtracking",
      "Sorting + Two Pointers → Sorted array problems",
      "Heap → Top-K elements, running median",
    ],
    example: 'For Two Sum: "This is a lookup problem. I can trade O(n) space for O(n) time by using a hash map to store complements."',
  },
  {
    letter: "P",
    word: "Plan",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/30",
    description: "Write your plan in pseudocode or plain English before coding.",
    tips: [
      "Describe your approach step-by-step out loud.",
      "Write pseudocode comments first, then fill in real code.",
      "Identify the time and space complexity upfront.",
      "Consider brute force first, then optimise — this shows growth.",
      "Ask the interviewer if the plan sounds right before coding.",
    ],
    example: "Plan:\n1. Create an empty hash map {value → index}\n2. Loop through each number with its index\n3. Calculate complement = target - num\n4. If complement is in map → return [map[complement], i]\n5. Else store num → index in map\nTime: O(n), Space: O(n)",
  },
  {
    letter: "I",
    word: "Implement",
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/30",
    description: "Write clean, readable code that mirrors your plan.",
    tips: [
      "Use meaningful variable names (not x, y, z).",
      "Code at a steady, comfortable pace — not rushed.",
      "Talk through each step as you code it.",
      "Don't delete everything if you make a mistake — cross out and annotate.",
      "Write helper functions if logic gets complex.",
    ],
    example: "Follow the pseudocode you wrote. Each comment becomes a line of real code.",
  },
  {
    letter: "R",
    word: "Review",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/30",
    description: "Trace through your code with a concrete example.",
    tips: [
      "Use the example from the problem and trace it manually.",
      "Check your loop bounds (off-by-one errors).",
      'Test edge cases: empty array, single element, all duplicates, "no solution".',
      "Look for null/None dereference risks.",
      "Verify your return statements handle all paths.",
    ],
    example: 'Input: nums=[2,7,11,15], target=9\nStep 1: map={}, i=0, num=2, complement=7 → not in map → map={2:0}\nStep 2: i=1, num=7, complement=2 → in map! → return [0, 1] ✓',
  },
  {
    letter: "E",
    word: "Evaluate",
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/30",
    description: "Analyse complexity and discuss trade-offs.",
    tips: [
      'Say: "Time complexity is O(n) because we traverse the array once."',
      'Say: "Space complexity is O(n) for the hash map."',
      "Discuss if a better solution exists (sometimes O(n log n) with less space).",
      "Mention what you'd do differently with more time.",
      "Ask: \"Does this meet the constraints you had in mind?\"",
    ],
    example: 'Brute Force: O(n²) time, O(1) space — nested loops.\nOptimised: O(n) time, O(n) space — hash map.\n"The hash map trades space for time, which is usually the right trade-off here."',
  },
];

const PATTERNS = [
  {
    name: "Two Pointers",
    icon: "↔",
    when: "Sorted arrays, pair sums, palindromes, removing duplicates",
    python: `def two_sum_sorted(nums: list[int], target: int) -> list[int]:
    left, right = 0, len(nums) - 1
    while left < right:
        total = nums[left] + nums[right]
        if total == target:
            return [left, right]
        elif total < target:
            left += 1
        else:
            right -= 1
    return []  # No solution found`,
    csharp: `public int[] TwoSumSorted(int[] nums, int target)
{
    int left = 0, right = nums.Length - 1;
    while (left < right)
    {
        int total = nums[left] + nums[right];
        if (total == target)  return new[] { left, right };
        else if (total < target) left++;
        else                     right--;
    }
    return Array.Empty<int>();
}`,
  },
  {
    name: "Sliding Window",
    icon: "▭",
    when: "Subarray/substring of length k, max/min subarray sum, longest substring",
    python: `def max_sum_subarray(nums: list[int], k: int) -> int:
    # Build first window
    window_sum = sum(nums[:k])
    max_sum = window_sum

    # Slide the window
    for i in range(k, len(nums)):
        window_sum += nums[i] - nums[i - k]  # add new, remove old
        max_sum = max(max_sum, window_sum)

    return max_sum`,
    csharp: `public int MaxSumSubarray(int[] nums, int k)
{
    int windowSum = nums[..k].Sum();
    int maxSum = windowSum;

    for (int i = k; i < nums.Length; i++)
    {
        windowSum += nums[i] - nums[i - k]; // add new, remove old
        maxSum = Math.Max(maxSum, windowSum);
    }
    return maxSum;
}`,
  },
  {
    name: "Hash Map",
    icon: "#",
    when: "Frequency counts, fast lookup, Two Sum, anagram detection",
    python: `def two_sum(nums: list[int], target: int) -> list[int]:
    seen = {}  # value → index
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []`,
    csharp: `public int[] TwoSum(int[] nums, int target)
{
    var seen = new Dictionary<int, int>(); // value → index
    for (int i = 0; i < nums.Length; i++)
    {
        int complement = target - nums[i];
        if (seen.ContainsKey(complement))
            return new[] { seen[complement], i };
        seen[nums[i]] = i;
    }
    return Array.Empty<int>();
}`,
  },
  {
    name: "BFS (Shortest Path)",
    icon: "◎",
    when: "Level-order traversal, shortest path in unweighted graph/grid",
    python: `from collections import deque

def bfs(graph: dict, start: int, end: int) -> int:
    queue = deque([(start, 0)])  # (node, distance)
    visited = {start}

    while queue:
        node, dist = queue.popleft()
        if node == end:
            return dist
        for neighbor in graph[node]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append((neighbor, dist + 1))
    return -1  # unreachable`,
    csharp: `public int Bfs(Dictionary<int, List<int>> graph, int start, int end)
{
    var queue = new Queue<(int node, int dist)>();
    var visited = new HashSet<int> { start };
    queue.Enqueue((start, 0));

    while (queue.Count > 0)
    {
        var (node, dist) = queue.Dequeue();
        if (node == end) return dist;
        foreach (var neighbor in graph[node])
            if (visited.Add(neighbor))
                queue.Enqueue((neighbor, dist + 1));
    }
    return -1;
}`,
  },
  {
    name: "DFS / Backtracking",
    icon: "↯",
    when: "Tree paths, permutations, combinations, maze solving",
    python: `def permutations(nums: list[int]) -> list[list[int]]:
    result = []

    def backtrack(path: list[int], remaining: list[int]):
        if not remaining:
            result.append(path[:])  # found a complete permutation
            return
        for i, num in enumerate(remaining):
            path.append(num)
            backtrack(path, remaining[:i] + remaining[i+1:])
            path.pop()  # undo the choice (backtrack)

    backtrack([], nums)
    return result`,
    csharp: `public IList<IList<int>> Permute(int[] nums)
{
    var result = new List<IList<int>>();
    void Backtrack(List<int> path, List<int> remaining)
    {
        if (remaining.Count == 0) { result.Add(new List<int>(path)); return; }
        for (int i = 0; i < remaining.Count; i++)
        {
            path.Add(remaining[i]);
            var next = remaining.Where((_, j) => j != i).ToList();
            Backtrack(path, next);
            path.RemoveAt(path.Count - 1); // backtrack
        }
    }
    Backtrack(new List<int>(), nums.ToList());
    return result;
}`,
  },
  {
    name: "Dynamic Programming",
    icon: "⬡",
    when: "Optimal substructure, overlapping subproblems — max/min/count problems",
    python: `def climb_stairs(n: int) -> int:
    # How many ways to climb n stairs (1 or 2 steps at a time)?
    # dp[i] = ways to reach step i
    if n <= 2:
        return n
    dp = [0] * (n + 1)
    dp[1], dp[2] = 1, 2
    for i in range(3, n + 1):
        dp[i] = dp[i - 1] + dp[i - 2]  # came from step i-1 or i-2
    return dp[n]`,
    csharp: `public int ClimbStairs(int n)
{
    // dp[i] = number of ways to reach step i
    if (n <= 2) return n;
    int[] dp = new int[n + 1];
    dp[1] = 1; dp[2] = 2;
    for (int i = 3; i <= n; i++)
        dp[i] = dp[i - 1] + dp[i - 2]; // came from step i-1 or i-2
    return dp[n];
}`,
  },
];

const MINDSET_CARDS = [
  {
    icon: Shield,
    title: "Reframe Failure",
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/30",
    points: [
      "The interviewer wants you to succeed — they're on your side.",
      "Getting stuck is normal. It shows you're working on hard problems.",
      'Saying "I don\'t know, but here\'s how I\'d figure it out" is a STRONG answer.',
      "Every interview is practice, not a final exam.",
    ],
  },
  {
    icon: MessageSquare,
    title: "Think Out Loud",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/30",
    points: [
      "Silence is the enemy. Narrate your thought process constantly.",
      'Say "I\'m thinking about using a hash map here because..."',
      "Wrong direction out loud = the interviewer can redirect you early.",
      "They're evaluating HOW you think, not just the final answer.",
    ],
  },
  {
    icon: TrendingUp,
    title: "Brute Force First",
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/30",
    points: [
      'Always start by saying "The naive approach would be O(n²)..."',
      "A working brute force is infinitely better than no solution.",
      "Then optimise from a position of strength, not panic.",
      "Interviewers love seeing the journey from naive → optimal.",
    ],
  },
  {
    icon: Clock,
    title: "Manage Your Time",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/30",
    points: [
      "Spend ~5 min on Understand + Match + Plan before coding.",
      "If stuck for >3 min, ask for a hint — don't silently spiral.",
      "Leave 3–5 min at the end to trace through and test.",
      "Partial credit is real: a clean 70% solution beats messy 100%.",
    ],
  },
];

const IMPRESS_TIPS = [
  {
    category: "Before You Code",
    icon: BookOpen,
    color: "text-purple-400",
    tips: [
      { label: "Clarify first", detail: 'Ask 2–3 smart questions. "What should I return if the array is empty?" shows you think about edge cases.' },
      { label: "State your approach", detail: '"I\'m going to use a hash map for O(1) lookup. Does that sound reasonable?" — gets buy-in before you invest time.' },
      { label: "Name your complexity", detail: '"This will be O(n) time and O(n) space." Say it before they ask.' },
    ],
  },
  {
    category: "While Coding",
    icon: Code2,
    color: "text-cyan-400",
    tips: [
      { label: "Write readable code", detail: "Name variables clearly: `complement`, `window_sum`, `left_ptr`. Avoid `x`, `tmp`, `a`." },
      { label: "Narrate decisions", detail: '"I\'m using a deque here because we need O(1) append and popleft."' },
      { label: "Don't erase mistakes", detail: "Comment out wrong attempts. It shows your problem-solving journey and you can reference them." },
    ],
  },
  {
    category: "After Coding",
    icon: CheckCircle2,
    color: "text-green-400",
    tips: [
      { label: "Dry-run your code", detail: "Trace through with the example input, step by step, updating variable values out loud." },
      { label: "Test edge cases proactively", detail: '"Let me also check: what if the array has one element? What if target is 0?" — don\'t wait to be asked.' },
      { label: "Offer improvements", detail: '"If the input were always sorted, I could do this in O(1) space with two pointers instead." Shows depth.' },
    ],
  },
  {
    category: "Soft Skills That Win",
    icon: Star,
    color: "text-yellow-400",
    tips: [
      { label: "Stay calm when corrected", detail: '"Oh, good catch! Let me fix that." Gratitude > defensiveness. Always.' },
      { label: "Ask follow-up questions", detail: '"What\'s the expected scale of input? Will this run millions of times?" Shows engineering instincts.' },
      { label: "Show enthusiasm", detail: '"This is an interesting problem — I\'ve seen a similar pattern with..." Genuine interest is magnetic.' },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle, color }: { icon: React.ElementType; title: string; subtitle: string; color: string }) {
  return (
    <div className="mb-8">
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-primary/10 border border-accent-primary/30 ${color} text-sm font-medium mb-4`}>
        <Icon className="w-4 h-4" />
        {title}
      </div>
      <h2 className="font-display text-3xl md:text-4xl font-bold text-text-primary mb-3">{title}</h2>
      <p className="text-text-secondary text-lg max-w-2xl">{subtitle}</p>
    </div>
  );
}

function UmpireStep({ step, index }: { step: typeof UMPIRE_STEPS[0]; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08 }}
      className={`border rounded-xl overflow-hidden ${step.bg}`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/5 transition-colors"
      >
        <span className={`font-display text-3xl font-black ${step.color} w-10 shrink-0`}>{step.letter}</span>
        <div className="flex-1">
          <div className={`font-display font-bold text-lg ${step.color}`}>{step.word}</div>
          <div className="text-text-secondary text-sm mt-0.5">{step.description}</div>
        </div>
        <ChevronDown className={`w-5 h-5 text-text-secondary transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-white/10 pt-4 space-y-4">
              <div>
                <div className="text-text-secondary text-xs uppercase tracking-wider font-semibold mb-2">Tips</div>
                <ul className="space-y-2">
                  {step.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                      <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${step.color}`} />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-text-secondary text-xs uppercase tracking-wider font-semibold mb-2">Example</div>
                <pre className="text-sm text-text-primary bg-black/30 rounded-lg p-4 whitespace-pre-wrap font-mono leading-relaxed border border-white/5">
                  {step.example}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PatternCard({ pattern, index }: { pattern: typeof PATTERNS[0]; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07 }}
      className="card border border-white/10"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/5 transition-colors"
      >
        <span className="font-display text-2xl w-10 text-center shrink-0">{pattern.icon}</span>
        <div className="flex-1">
          <div className="font-display font-bold text-text-primary">{pattern.name}</div>
          <div className="text-text-secondary text-xs mt-0.5">Use when: {pattern.when}</div>
        </div>
        <ChevronRight className={`w-5 h-5 text-text-secondary transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10">
              <CodeBlock python={pattern.python} csharp={pattern.csharp} title={pattern.name} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InterviewPrepTutorial() {
  const [activeNav, setActiveNav] = useState("mindset");

  const navItems = [
    { id: "mindset", label: "Mindset", icon: Shield },
    { id: "umpire", label: "UMPIRE Framework", icon: Target },
    { id: "patterns", label: "Code Patterns", icon: Code2 },
    { id: "impress", label: "Impress the Interviewer", icon: Trophy },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* ── Hero ── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-14"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-primary/10 border border-accent-primary/30 text-accent-primary text-sm font-medium mb-6">
          <Zap className="w-4 h-4" />
          Coding Interview Prep
        </div>
        <h1 className="font-display text-5xl md:text-6xl font-black text-text-primary mb-4 leading-tight">
          Crack Any Interview.
          <br />
          <span className="gradient-text">Build Real Confidence.</span>
        </h1>
        <p className="text-text-secondary text-xl max-w-2xl mx-auto leading-relaxed">
          A practical, no-fluff guide to thinking through coding problems with clarity — in Python or C#.
        </p>

        {/* Quick-win callout */}
        <div className="mt-8 inline-flex items-start gap-3 px-5 py-4 bg-accent-secondary/10 border border-accent-secondary/30 rounded-xl text-left max-w-xl">
          <Lightbulb className="w-5 h-5 text-accent-secondary mt-0.5 shrink-0" />
          <p className="text-sm text-text-primary">
            <span className="font-semibold text-accent-secondary">The secret:</span> Interviewers hire people who think clearly under pressure — not people who memorise every algorithm. This guide teaches you to think.
          </p>
        </div>
      </motion.div>

      {/* ── Nav ── */}
      <div className="flex flex-wrap gap-2 mb-12 sticky top-16 z-10 py-3 bg-bg-primary/90 backdrop-blur-md border-b border-white/5">
        {navItems.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={`#${id}`}
            onClick={() => setActiveNav(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeNav === id
                ? "bg-accent-primary text-white"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </a>
        ))}
      </div>

      {/* ── Section 1: Mindset ── */}
      <section id="mindset" className="mb-20 scroll-mt-24">
        <SectionHeader
          icon={Shield}
          title="Build an Unshakeable Mindset"
          subtitle="Fear of failure is the #1 reason people underperform. Here's how to reframe it."
          color="text-purple-400"
        />

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {MINDSET_CARDS.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`p-5 rounded-xl border ${card.bg}`}
            >
              <div className={`flex items-center gap-2 font-display font-bold mb-3 ${card.color}`}>
                <card.icon className="w-5 h-5" />
                {card.title}
              </div>
              <ul className="space-y-2">
                {card.points.map((p, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${card.color.replace("text-", "bg-")} shrink-0`} />
                    {p}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Confidence affirmations */}
        <div className="p-6 rounded-xl bg-gradient-to-r from-accent-primary/10 to-accent-secondary/10 border border-accent-primary/20">
          <div className="flex items-center gap-2 text-accent-primary font-display font-bold mb-3">
            <Brain className="w-5 h-5" /> Pre-Interview Mental Reset
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {[
              { q: "What if I get stuck?", a: 'Say "Let me think through this..." then apply UMPIRE. Getting stuck is expected.' },
              { q: "What if I'm wrong?", a: '"Thanks for the correction — let me rethink." Adaptability is a green flag.' },
              { q: "What if I don't know it?", a: '"I haven\'t seen this exact pattern, but I\'d approach it by..." shows resourcefulness.' },
            ].map(({ q, a }) => (
              <div key={q} className="p-4 bg-black/20 rounded-lg">
                <div className="text-text-primary text-sm font-semibold mb-1.5 flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" /> {q}
                </div>
                <div className="text-text-secondary text-xs leading-relaxed">{a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 2: UMPIRE ── */}
      <section id="umpire" className="mb-20 scroll-mt-24">
        <SectionHeader
          icon={Target}
          title="The UMPIRE Framework"
          subtitle="A repeatable 6-step system. Apply it to every problem, every time, and you'll never blank out again."
          color="text-blue-400"
        />

        {/* Framework overview */}
        <div className="flex flex-wrap gap-2 mb-6">
          {UMPIRE_STEPS.map((s) => (
            <div key={s.letter} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-mono font-bold ${s.bg} ${s.color}`}>
              <span className="text-lg">{s.letter}</span>
              <span className="font-sans font-medium text-text-secondary text-xs">{s.word}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {UMPIRE_STEPS.map((step, i) => (
            <UmpireStep key={step.letter} step={step} index={i} />
          ))}
        </div>

        {/* Time allocation guide */}
        <div className="mt-6 p-5 card border border-white/10">
          <div className="font-display font-bold text-text-primary mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent-primary" /> Time Allocation (45-min Interview)
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { phase: "Understand + Match", time: "5 min", color: "bg-purple-500" },
              { phase: "Plan (pseudocode)", time: "5 min", color: "bg-blue-500" },
              { phase: "Implement", time: "20 min", color: "bg-green-500" },
              { phase: "Review + Test", time: "10 min", color: "bg-yellow-500" },
              { phase: "Evaluate + Q&A", time: "5 min", color: "bg-orange-500" },
            ].map(({ phase, time, color }) => (
              <div key={phase} className="flex items-center gap-3 p-3 bg-bg-surface rounded-lg">
                <div className={`w-2 h-8 rounded-full ${color} shrink-0`} />
                <div>
                  <div className="text-text-primary text-sm font-medium">{phase}</div>
                  <div className="text-text-secondary text-xs">{time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3: Patterns ── */}
      <section id="patterns" className="mb-20 scroll-mt-24">
        <SectionHeader
          icon={Code2}
          title="Essential Code Patterns"
          subtitle="Master these 6 patterns and you can solve ~80% of interview problems. Click each to see Python & C# implementations."
          color="text-green-400"
        />

        {/* Pattern cheat-sheet */}
        <div className="mb-6 p-4 bg-bg-surface rounded-xl border border-white/10">
          <div className="text-text-secondary text-xs uppercase tracking-wider font-semibold mb-3">Quick Pattern Selector</div>
          <div className="grid md:grid-cols-2 gap-2 text-sm">
            {[
              { signal: "Sorted array, pairs, palindrome", pattern: "→ Two Pointers" },
              { signal: "Subarray / substring of size k", pattern: "→ Sliding Window" },
              { signal: "Fast lookup, frequency, Two Sum", pattern: "→ Hash Map" },
              { signal: "Shortest path, level order", pattern: "→ BFS" },
              { signal: "All paths, permutations, combinations", pattern: "→ DFS / Backtracking" },
              { signal: "Max/min, count, overlapping subproblems", pattern: "→ Dynamic Programming" },
            ].map(({ signal, pattern }) => (
              <div key={signal} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5">
                <span className="text-text-secondary">"{signal}"</span>
                <span className="text-accent-secondary font-mono font-semibold ml-auto">{pattern}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {PATTERNS.map((pattern, i) => (
            <PatternCard key={pattern.name} pattern={pattern} index={i} />
          ))}
        </div>
      </section>

      {/* ── Section 4: Impress the Interviewer ── */}
      <section id="impress" className="mb-20 scroll-mt-24">
        <SectionHeader
          icon={Trophy}
          title="How to Impress the Interviewer"
          subtitle="The best candidates don't just solve problems — they make interviewers want to work with them. Here's exactly how."
          color="text-yellow-400"
        />

        <div className="space-y-6">
          {IMPRESS_TIPS.map((section, i) => (
            <motion.div
              key={section.category}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="card border border-white/10 p-5"
            >
              <div className={`flex items-center gap-2 font-display font-bold mb-4 ${section.color}`}>
                <section.icon className="w-5 h-5" />
                {section.category}
              </div>
              <div className="space-y-3">
                {section.tips.map(({ label, detail }) => (
                  <div key={label} className="flex gap-3">
                    <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${section.color.replace("text-", "bg-")}`} />
                    <div>
                      <span className="text-text-primary text-sm font-semibold">{label}: </span>
                      <span className="text-text-secondary text-sm">{detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Phrases that win */}
        <div className="mt-8 p-6 rounded-xl bg-gradient-to-br from-accent-primary/10 to-accent-secondary/5 border border-accent-primary/20">
          <div className="font-display font-bold text-text-primary mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-accent-primary" /> Power Phrases — Say These Out Loud
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              { moment: "When starting", phrase: '"Let me make sure I understand the problem. So I\'m given..."' },
              { moment: "Before coding", phrase: '"My approach is [X]. Time: O(n), Space: O(n). Does that sound right?"' },
              { moment: "While coding", phrase: '"I\'m using a hash map here because I need O(1) lookup..."' },
              { moment: "When stuck", phrase: '"I\'m going to pause and think about this differently..."' },
              { moment: "After testing", phrase: '"Let me also check the edge case where the input is empty."' },
              { moment: "At the end", phrase: '"If I had more time, I\'d optimise this by..."' },
            ].map(({ moment, phrase }) => (
              <div key={moment} className="p-3 bg-black/30 rounded-lg">
                <div className="text-accent-secondary text-xs font-semibold uppercase tracking-wider mb-1">{moment}</div>
                <div className="text-text-primary text-sm font-mono italic">{phrase}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center py-12 px-6 rounded-2xl bg-gradient-to-br from-accent-primary/10 via-bg-surface to-accent-secondary/10 border border-accent-primary/20"
      >
        <div className="text-4xl mb-4">🚀</div>
        <h3 className="font-display text-2xl font-bold text-text-primary mb-2">You're More Ready Than You Think</h3>
        <p className="text-text-secondary max-w-md mx-auto text-sm leading-relaxed mb-6">
          Apply UMPIRE to every practice problem. Think out loud every time. The algorithm knowledge will come — the mindset is what separates candidates.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {["LeetCode Easy → Medium → Hard", "1 problem/day beats 10 problems before interview", "Review your solutions after, not before"].map((tip) => (
            <span key={tip} className="px-3 py-1.5 text-xs bg-accent-primary/10 border border-accent-primary/30 rounded-full text-accent-primary">
              {tip}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
