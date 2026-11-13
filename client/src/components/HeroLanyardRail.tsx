import React from "react";
import TeamLanyardRail, { type LanyardMember } from "./ui/team-lanyard-rail";

// TODO: replace with real names/photos
export const HERO_BADGES: LanyardMember[] = [
  {
    id: "student-aarav",
    name: "Aarav Sharma",
    role: "Grade 11 · Science",
    team: "Greenwood International School",
    tone: 1,
    image: "/home/lanyards/student-aarav.webp",
    bio: "Authorized student smart badge with campus RFID access and library checkout.",
    tags: ["Student ID", "CBSE 2026", "Bus Route 4"],
    links: [{ label: "Email", href: "/contact" }],
  },
  {
    id: "faculty-priya",
    name: "Dr. Priya Patel",
    role: "Vice Principal & Academics",
    team: "Heritage Academy",
    tone: 2,
    image: "/home/lanyards/faculty-priya.webp",
    bio: "Senior faculty credential with biometric entry and administrative authorization.",
    tags: ["Faculty", "Staff Gate A", "Exam In-Charge"],
    links: [{ label: "Email", href: "/contact" }],
  },
  {
    id: "admin-vikram",
    name: "Vikram Malhotra",
    role: "Campus Operations Lead",
    team: "Apex Public School",
    tone: 3,
    image: "/home/lanyards/admin-vikram.webp",
    bio: "Facility manager badge with all-zone security clearance and visitor management.",
    tags: ["Operations", "Safety Team", "All Zones"],
    links: [{ label: "Email", href: "/contact" }],
  },
  {
    id: "student-ananya",
    name: "Ananya Sen",
    role: "Grade 10 · Humanities",
    team: "St. Xavier's High School",
    tone: 4,
    image: "/home/lanyards/student-ananya.webp",
    bio: "Durable PVC student badge featuring high-clarity color photo and dynamic QR code.",
    tags: ["Student ID", "ICSE 2026", "Day Scholar"],
    links: [{ label: "Email", href: "/contact" }],
  },
  {
    id: "faculty-rohit",
    name: "Prof. Rohit Verma",
    role: "Head of Computer Science",
    team: "Delhi Scholars Academy",
    tone: 5,
    image: "/home/lanyards/faculty-rohit.webp",
    bio: "Smart ID card integrated with computer lab access control and attendance logging.",
    tags: ["Department Head", "Lab Access", "Mentor"],
    links: [{ label: "Email", href: "/contact" }],
  },
  {
    id: "staff-sneha",
    name: "Sneha Roy",
    role: "Senior Lab Technician",
    team: "National Model School",
    tone: 2,
    image: "/home/lanyards/staff-sneha.webp",
    bio: "Custom lanyard and metallic clip assembly with color-coded safety department tag.",
    tags: ["STEM Lab", "Safety Officer", "Staff"],
    links: [{ label: "Email", href: "/contact" }],
  },
  {
    id: "student-kavya",
    name: "Kavya Iyer",
    role: "Student Council President",
    team: "Sunrise Collegiate",
    tone: 1,
    image: "/home/lanyards/student-kavya.webp",
    bio: "Premium lanyard badge with custom printed satin ribbon and barcode tracking.",
    tags: ["Council", "Ambassador", "Grade 12"],
    links: [{ label: "Email", href: "/contact" }],
  },
  {
    id: "officer-arjun",
    name: "Arjun Das",
    role: "Administrative Officer",
    team: "Pinegrove Academy",
    tone: 3,
    image: "/home/lanyards/officer-arjun.webp",
    bio: "Dual-sided laminated staff badge with QR credential verification and emergency contacts.",
    tags: ["Administration", "Accounts", "Verified"],
    links: [{ label: "Email", href: "/contact" }],
  },
];

export default function HeroLanyardRail() {
  return (
    <div className="lp-hero-rail">
      <TeamLanyardRail
        items={HERO_BADGES}
        caption=""
        labels={{
          flip: "",
          back: "",
          show: "Show",
        }}
        autoplay
        interval={2800}
        className="bg-transparent! min-h-0"
      />
    </div>
  );
}
