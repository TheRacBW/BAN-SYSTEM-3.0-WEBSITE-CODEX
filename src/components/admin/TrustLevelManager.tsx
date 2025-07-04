import React from "react";

const trustLevels = [
  { level: 0, label: "New", color: "badge-neutral", desc: "Limited access, manual approval required." },
  { level: 1, label: "Trusted", color: "badge-info", desc: "Can submit and edit content, auto-approval enabled." },
  { level: 2, label: "Moderator", color: "badge-success", desc: "Can moderate users and submissions." },
];

const TrustLevelManager: React.FC = () => (
  <div className="mt-8">
    <h3 className="text-lg font-bold mb-2">Trust Level System</h3>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {trustLevels.map(tl => (
        <div key={tl.level} className="card bg-base-200 p-4">
          <span className={`badge ${tl.color} mb-2`}>{tl.label}</span>
          <div>{tl.desc}</div>
        </div>
      ))}
    </div>
  </div>
);

export default TrustLevelManager; 