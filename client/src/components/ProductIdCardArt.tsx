import React from "react";

export default function ProductIdCardArt({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  const rawId = React.useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const shadowId = `${uid}-shadow`;
  const stripeId = `${uid}-stripe`;
  const bgGradId = `${uid}-bg`;

  return (
    <svg
      viewBox="0 0 960 560"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={label ?? "Sample school ID cards on lanyards"}
      className={className}
      width="100%"
      height="100%"
      style={{ display: "block" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Soft studio mint radial highlight */}
        <radialGradient id={bgGradId} cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="70%" stopColor="#ffffff" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        {/* Soft shadow for hanging cards */}
        <filter id={shadowId} x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow
            dx="0"
            dy="10"
            stdDeviation="10"
            floodColor="#000000"
            floodOpacity="0.22"
          />
        </filter>

        {/* Subtle diagonal stripe for card bands */}
        <pattern
          id={stripeId}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="8"
            stroke="#ffffff"
            strokeWidth="1.2"
            strokeOpacity="0.12"
          />
        </pattern>

        {/* Card outline clip paths for clean band and header rounding */}
        <clipPath id={`${uid}-card-shape`}>
          <rect x="0" y="0" width="150" height="230" rx="14" />
        </clipPath>
      </defs>

      {/* Studio mint background */}
      <rect width="960" height="560" fill="#dbeede" />
      <rect width="960" height="560" fill={`url(#${bgGradId})`} />

      {/* ──────────────────────────────────────────────────────────
          LEFT CARD: Rotated -9deg, coral (#f28a63), 92% scale
          ────────────────────────────────────────────────────────── */}
      <g
        transform="translate(350, 160) rotate(-9) scale(0.92) translate(-75, 0)"
        filter={`url(#${shadowId})`}
      >
        {/* Lanyard Strap */}
        <rect
          x="67"
          y="-120"
          width="16"
          height="125"
          fill="#f28a63"
          stroke="#df734a"
          strokeWidth="1"
        />
        <rect
          x="67"
          y="-120"
          width="16"
          height="125"
          fill={`url(#${stripeId})`}
        />

        {/* Dark swivel & metal clamp */}
        <circle cx="75" cy="5" r="7" fill="#1e293b" />
        <rect
          x="69"
          y="6"
          width="12"
          height="14"
          rx="3"
          fill="#94a3b8"
          stroke="#64748b"
          strokeWidth="1"
        />

        {/* Card Body */}
        <g transform="translate(0, 16)" clipPath={`url(#${uid}-card-shape)`}>
          <rect
            width="150"
            height="230"
            fill="#fffefb"
            stroke="rgba(0,0,0,0.08)"
            strokeWidth="1"
          />
          {/* Top Coral Band */}
          <rect width="150" height="64" fill="#f28a63" />
          <rect width="150" height="64" fill={`url(#${stripeId})`} />
          <polygon points="0,0 28,0 0,28" fill="#f2c94c" />

          {/* Lanyard punch hole */}
          <rect
            x="64"
            y="7"
            width="22"
            height="5"
            rx="2.5"
            fill="#dbeede"
            stroke="rgba(0,0,0,0.15)"
            strokeWidth="0.8"
          />

          {/* Header text */}
          <text
            x="75"
            y="35"
            textAnchor="middle"
            fill="#ffffff"
            fontWeight="800"
            fontSize="12"
            fontFamily="Lato, system-ui, sans-serif"
            letterSpacing="0.5"
          >
            ACADEMY PASS
          </text>
          <text
            x="75"
            y="52"
            textAnchor="middle"
            fill="#ffffff"
            fontWeight="600"
            fontSize="9"
            fontFamily="Lato, system-ui, sans-serif"
            opacity="0.9"
            letterSpacing="0.4"
          >
            FACULTY &amp; STAFF
          </text>

          {/* Photo Silhouette Avatar */}
          <circle
            cx="75"
            cy="95"
            r="22"
            fill="#e2e8f0"
            stroke="#ffffff"
            strokeWidth="2"
          />
          <circle cx="75" cy="89" r="8" fill="#94a3b8" />
          <path
            d="M60,111 C60,103 66,99 75,99 C84,99 90,103 90,111 Z"
            fill="#94a3b8"
          />

          {/* Text lines */}
          <rect x="25" y="132" width="100" height="6" rx="3" fill="#64748b" />
          <rect x="35" y="146" width="80" height="5" rx="2.5" fill="#94a3b8" />
          <rect x="40" y="158" width="70" height="5" rx="2.5" fill="#cbd5e1" />

          {/* Barcode */}
          <g transform="translate(20, 182)">
            {[0, 4, 8, 11, 16, 20, 23, 28, 33, 36, 42, 46, 51, 55, 60, 64, 69, 74, 78, 83, 88, 93, 98, 103, 107].map(
              (x, i) => (
                <rect
                  key={i}
                  x={x}
                  y="0"
                  width={i % 3 === 0 ? 2.5 : 1.3}
                  height="16"
                  fill="#334155"
                />
              )
            )}
          </g>
          <text
            x="75"
            y="212"
            textAnchor="middle"
            fill="#64748b"
            fontSize="8"
            fontFamily="monospace"
            letterSpacing="2"
          >
            FAC-88219
          </text>
        </g>
      </g>

      {/* ──────────────────────────────────────────────────────────
          RIGHT CARD: Rotated +9deg, indigo (#6a78d4), 92% scale (BACK)
          ────────────────────────────────────────────────────────── */}
      <g
        transform="translate(610, 160) rotate(9) scale(0.92) translate(-75, 0)"
        filter={`url(#${shadowId})`}
      >
        {/* Lanyard Strap */}
        <rect
          x="67"
          y="-120"
          width="16"
          height="125"
          fill="#6a78d4"
          stroke="#5562b8"
          strokeWidth="1"
        />
        <rect
          x="67"
          y="-120"
          width="16"
          height="125"
          fill={`url(#${stripeId})`}
        />

        {/* Dark swivel & metal clamp */}
        <circle cx="75" cy="5" r="7" fill="#1e293b" />
        <rect
          x="69"
          y="6"
          width="12"
          height="14"
          rx="3"
          fill="#94a3b8"
          stroke="#64748b"
          strokeWidth="1"
        />

        {/* Card Body (BACK view) */}
        <g transform="translate(0, 16)" clipPath={`url(#${uid}-card-shape)`}>
          <rect
            width="150"
            height="230"
            fill="#fffefb"
            stroke="rgba(0,0,0,0.08)"
            strokeWidth="1"
          />
          {/* Top Indigo Band */}
          <rect width="150" height="42" fill="#6a78d4" />
          <rect width="150" height="42" fill={`url(#${stripeId})`} />

          {/* Lanyard punch hole */}
          <rect
            x="64"
            y="7"
            width="22"
            height="5"
            rx="2.5"
            fill="#dbeede"
            stroke="rgba(0,0,0,0.15)"
            strokeWidth="0.8"
          />

          <text
            x="75"
            y="32"
            textAnchor="middle"
            fill="#ffffff"
            fontWeight="700"
            fontSize="10"
            fontFamily="Lato, system-ui, sans-serif"
            letterSpacing="0.8"
          >
            TERMS &amp; SECURITY
          </text>

          {/* Informational text lines */}
          <rect x="18" y="58" width="114" height="4" rx="2" fill="#64748b" />
          <rect x="18" y="68" width="98" height="4" rx="2" fill="#94a3b8" />
          <rect x="18" y="78" width="108" height="4" rx="2" fill="#cbd5e1" />
          <rect x="18" y="88" width="85" height="4" rx="2" fill="#cbd5e1" />

          {/* Mini QR-code style grid (7x7) */}
          <g transform="translate(43, 108)">
            <rect width="64" height="64" rx="6" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
            {/* Corner position markers */}
            <rect x="6" y="6" width="16" height="16" fill="#1e293b" rx="2" />
            <rect x="9" y="9" width="10" height="10" fill="#ffffff" rx="1" />
            <rect x="11" y="11" width="6" height="6" fill="#1e293b" />

            <rect x="42" y="6" width="16" height="16" fill="#1e293b" rx="2" />
            <rect x="45" y="9" width="10" height="10" fill="#ffffff" rx="1" />
            <rect x="47" y="11" width="6" height="6" fill="#1e293b" />

            <rect x="6" y="42" width="16" height="16" fill="#1e293b" rx="2" />
            <rect x="9" y="45" width="10" height="10" fill="#ffffff" rx="1" />
            <rect x="11" y="47" width="6" height="6" fill="#1e293b" />

            {/* Data blocks */}
            <rect x="26" y="10" width="5" height="5" fill="#1e293b" />
            <rect x="33" y="14" width="5" height="5" fill="#1e293b" />
            <rect x="25" y="24" width="6" height="6" fill="#1e293b" />
            <rect x="34" y="27" width="5" height="5" fill="#1e293b" />
            <rect x="44" y="25" width="6" height="6" fill="#1e293b" />
            <rect x="12" y="28" width="5" height="5" fill="#1e293b" />
            <rect x="26" y="36" width="6" height="6" fill="#1e293b" />
            <rect x="35" y="40" width="6" height="6" fill="#1e293b" />
            <rect x="45" y="36" width="5" height="5" fill="#1e293b" />
            <rect x="28" y="48" width="5" height="5" fill="#1e293b" />
            <rect x="42" y="47" width="7" height="6" fill="#1e293b" />
          </g>

          <text
            x="75"
            y="190"
            textAnchor="middle"
            fill="#475569"
            fontSize="9"
            fontWeight="600"
            fontFamily="Lato, system-ui, sans-serif"
          >
            Scan for Verification
          </text>
          <text
            x="75"
            y="206"
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="8"
            fontFamily="Lato, system-ui, sans-serif"
          >
            Property of Institution
          </text>
        </g>
      </g>

      {/* ──────────────────────────────────────────────────────────
          CENTRE CARD: Rotated 0deg, teal (#40c8bb), full scale (FRONT)
          ────────────────────────────────────────────────────────── */}
      <g transform="translate(480, 155) translate(-75, 0)" filter={`url(#${shadowId})`}>
        {/* Lanyard Strap starting inside viewBox at y=40 */}
        <rect
          x="67"
          y="-115"
          width="16"
          height="125"
          fill="#40c8bb"
          stroke="#2aa69a"
          strokeWidth="1"
        />
        <rect
          x="67"
          y="-115"
          width="16"
          height="125"
          fill={`url(#${stripeId})`}
        />

        {/* Dark swivel & metal clamp */}
        <circle cx="75" cy="6" r="7" fill="#1e293b" />
        <rect
          x="69"
          y="7"
          width="12"
          height="14"
          rx="3"
          fill="#94a3b8"
          stroke="#64748b"
          strokeWidth="1"
        />

        {/* Card Body */}
        <g transform="translate(0, 18)" clipPath={`url(#${uid}-card-shape)`}>
          <rect
            width="150"
            height="230"
            fill="#fffefb"
            stroke="rgba(0,0,0,0.08)"
            strokeWidth="1"
          />

          {/* Top Teal Band (64px) */}
          <rect width="150" height="64" fill="#40c8bb" />
          <rect width="150" height="64" fill={`url(#${stripeId})`} />

          {/* Yellow accent triangle */}
          <polygon points="0,0 32,0 0,32" fill="#f2c94c" />

          {/* Lanyard punch hole */}
          <rect
            x="64"
            y="7"
            width="22"
            height="5"
            rx="2.5"
            fill="#dbeede"
            stroke="rgba(0,0,0,0.18)"
            strokeWidth="0.8"
          />

          {/* School Name & Student ID Label */}
          <text
            x="75"
            y="36"
            textAnchor="middle"
            fill="#ffffff"
            fontWeight="800"
            fontSize="12.5"
            fontFamily="Lato, system-ui, sans-serif"
            letterSpacing="0.4"
          >
            My School NAME
          </text>
          <text
            x="75"
            y="52"
            textAnchor="middle"
            fill="#ffffff"
            fontWeight="700"
            fontSize="9.5"
            fontFamily="Lato, system-ui, sans-serif"
            opacity="0.95"
            letterSpacing="0.8"
          >
            STUDENT ID CARD
          </text>

          {/* Photo Avatar Frame */}
          <circle
            cx="75"
            cy="98"
            r="24"
            fill="#e2e8f0"
            stroke="#ffffff"
            strokeWidth="2.5"
          />
          {/* Silhouette Head & Body */}
          <circle cx="75" cy="91" r="9" fill="#94a3b8" />
          <path
            d="M59,116 C59,106 65,102 75,102 C85,102 91,106 91,116 Z"
            fill="#94a3b8"
          />

          {/* 3 Text Lines (Name / Class / D.O.B.) */}
          <g transform="translate(18, 132)">
            {/* Line 1: Name */}
            <text
              x="0"
              y="10"
              fill="#334155"
              fontWeight="700"
              fontSize="11"
              fontFamily="Lato, system-ui, sans-serif"
            >
              Name:
            </text>
            <rect x="42" y="3" width="70" height="7" rx="3.5" fill="#64748b" />

            {/* Line 2: Class */}
            <text
              x="0"
              y="26"
              fill="#334155"
              fontWeight="700"
              fontSize="11"
              fontFamily="Lato, system-ui, sans-serif"
            >
              Class:
            </text>
            <rect x="42" y="19" width="50" height="7" rx="3.5" fill="#94a3b8" />

            {/* Line 3: D.O.B. */}
            <text
              x="0"
              y="42"
              fill="#334155"
              fontWeight="700"
              fontSize="11"
              fontFamily="Lato, system-ui, sans-serif"
            >
              D.O.B:
            </text>
            <rect x="42" y="35" width="56" height="7" rx="3.5" fill="#cbd5e1" />
          </g>

          {/* Barcode at bottom */}
          <g transform="translate(20, 185)">
            {[
              0, 3, 5, 9, 12, 14, 18, 22, 25, 27, 31, 35, 39, 41, 46, 50,
              53, 57, 60, 62, 66, 70, 74, 77, 81, 84, 86, 90, 94, 98, 102,
              106,
            ].map((x, i) => (
              <rect
                key={i}
                x={x}
                y="0"
                width={i % 4 === 0 ? 2.6 : i % 2 === 0 ? 1.8 : 1.2}
                height="18"
                fill="#1e293b"
              />
            ))}
          </g>
          <text
            x="75"
            y="216"
            textAnchor="middle"
            fill="#475569"
            fontSize="8.5"
            fontFamily="monospace"
            letterSpacing="2.5"
          >
            2026-STU-0492
          </text>
        </g>
      </g>
    </svg>
  );
}
