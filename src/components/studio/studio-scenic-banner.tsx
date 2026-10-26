import React from "react"

export function StudioScenicBanner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative hidden md:flex items-center justify-end overflow-hidden select-none ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 380 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-80 lg:w-96 h-24 overflow-visible"
      >
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--banner-sky)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--banner-sky)" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="hillBackGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--banner-hill-back)" />
            <stop offset="100%" stopColor="var(--banner-hill-front)" />
          </linearGradient>
          <linearGradient id="hillFrontGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--banner-hill-front)" />
            <stop offset="100%" stopColor="var(--banner-hill-back)" />
          </linearGradient>
          <linearGradient id="riverGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--banner-river)" />
            <stop offset="100%" stopColor="var(--info)" />
          </linearGradient>
        </defs>

        {/* Soft Sky Background Pill */}
        <rect
          x="30"
          y="6"
          width="340"
          height="98"
          rx="40"
          fill="url(#skyGrad)"
        />

        {/* Clouds */}
        <path
          d="M70 28 C70 22 76 18 82 18 C86 14 93 14 97 18 C102 17 107 21 107 26 C110 26 113 29 113 32 C113 36 109 38 105 38 L72 38 C68 38 65 35 65 31 C65 29 68 28 70 28 Z"
          fill="var(--card)"
          opacity="0.85"
        />
        <path
          d="M190 22 C190 18 194 15 198 15 C201 12 206 12 209 15 C213 14 217 17 217 21 C219 21 221 23 221 25 C221 28 218 30 215 30 L191 30 C188 30 186 28 186 25 C186 23 188 22 190 22 Z"
          fill="var(--card)"
          opacity="0.75"
        />

        {/* Sun Glow */}
        <circle cx="280" cy="24" r="14" fill="var(--warning-subtle)" />
        <circle cx="280" cy="24" r="9" fill="var(--warning)" opacity="0.6" />

        {/* Back Rolling Hills */}
        <path
          d="M40 95 Q 120 45 200 80 T 360 75 L 360 104 L 40 104 Z"
          fill="url(#hillBackGrad)"
          opacity="0.9"
        />

        {/* Deep Green Trees (Back) */}
        <circle cx="130" cy="72" r="12" fill="var(--banner-tree)" />
        <circle cx="144" cy="68" r="15" fill="var(--banner-tree)" />
        <circle cx="158" cy="74" r="11" fill="var(--banner-tree)" />
        <circle cx="218" cy="75" r="13" fill="var(--banner-tree)" />
        <circle cx="230" cy="72" r="16" fill="var(--banner-tree)" />
        <circle cx="244" cy="76" r="12" fill="var(--banner-tree)" />

        {/* Winding River */}
        <path
          d="M178 104 C 180 92, 190 88, 192 84 C 195 80, 202 78, 205 76 L 214 76 C 210 80, 202 83, 199 87 C 196 92, 188 96, 186 104 Z"
          fill="url(#riverGrad)"
        />

        {/* Front Rolling Hill */}
        <path
          d="M70 104 Q 160 55 240 85 Q 290 70 360 92 L 360 104 L 70 104 Z"
          fill="url(#hillFrontGrad)"
        />

        {/* Foreground Trees & Shrubs */}
        <circle cx="120" cy="85" r="10" fill="var(--banner-hill-back)" />
        <circle cx="128" cy="88" r="8" fill="var(--banner-hill-front)" />
        <circle cx="242" cy="86" r="9" fill="var(--banner-hill-back)" />

        {/* Cute Cottage */}
        {/* House Shadow */}
        <ellipse cx="180" cy="88" rx="20" ry="4" fill="var(--foreground)" opacity="0.1" />

        {/* House Walls */}
        <rect x="166" y="65" width="28" height="20" rx="2" fill="var(--banner-wall)" />
        {/* Door */}
        <rect x="177" y="73" width="6" height="12" rx="1" fill="var(--banner-roof)" opacity="0.8" />
        {/* Window */}
        <rect x="169" y="70" width="5" height="5" rx="1" fill="var(--info)" />
        <rect x="186" y="70" width="5" height="5" rx="1" fill="var(--info)" />

        {/* Chimney */}
        <rect x="187" y="52" width="4" height="10" fill="var(--muted-foreground)" />
        {/* Chimney Smoke Puff */}
        <circle cx="189" cy="48" r="3" fill="var(--card)" opacity="0.7" />
        <circle cx="192" cy="43" r="4" fill="var(--card)" opacity="0.5" />

        {/* House Red Roof */}
        <polygon points="162,65 180,48 198,65" fill="var(--banner-roof)" />

        {/* Playful Tilted Text "Turn Stories Into Videos" */}
        <g transform="rotate(7 310 40)">
          <text
            x="270"
            y="42"
            fill="var(--banner-ribbon-text)"
            fontFamily="var(--font-sans)"
            fontSize="14"
            fontWeight="800"
            letterSpacing="-0.02em"
          >
            Turn Stories
          </text>
          <text
            x="274"
            y="58"
            fill="var(--banner-ribbon-text)"
            fontFamily="var(--font-sans)"
            fontSize="14"
            fontWeight="800"
            letterSpacing="-0.02em"
          >
            Into Videos
          </text>
        </g>
      </svg>
    </div>
  )
}
