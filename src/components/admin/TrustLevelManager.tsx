import React from "react";

const trustLevels = [
  { level: 0, label: "New", color: "badge-neutral", desc: "Limited access, manual approval required." },
  { level: 1, label: "Trusted", color: "badge-info", desc: "Can submit and edit content, auto-approval enabled." },
  { level: 2, label: "Moderator", color: "badge-success", desc: "Can moderate users and submissions." },
];

const TrustLevelManager: React.FC = () => null;

export default TrustLevelManager; 