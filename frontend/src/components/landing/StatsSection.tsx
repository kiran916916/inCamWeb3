"use client";

import { motion } from "framer-motion";
import { Users, Image, DollarSign, Trophy } from "lucide-react";

const stats = [
  { icon: Users, label: "Active Creators", value: "12,400+", color: "text-accent-primary" },
  { icon: Image, label: "NFTs Minted", value: "284,000+", color: "text-accent-secondary" },
  { icon: DollarSign, label: "Total Trading Volume", value: "$4.2M+", color: "text-brand-warning" },
  { icon: Trophy, label: "Rewards Distributed", value: "18M INCAM", color: "text-accent-primary" },
];

export function StatsSection() {
  return (
    <section className="py-20 px-4 bg-bg-secondary/50">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="card p-6 text-center"
          >
            <div className={`flex justify-center mb-4 ${stat.color}`}>
              <stat.icon className="w-8 h-8" />
            </div>
            <div className="font-display text-3xl font-bold text-text-primary mb-1">{stat.value}</div>
            <div className="text-text-secondary text-sm">{stat.label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
