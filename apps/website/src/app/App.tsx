import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import cloudsBg from "../imports/ChatGPT_Image_12____._2026__.__14_33_36.png";
import { getPublicReleases } from "../data/releases";

type Page = "home" | "how" | "app" | "download" | "new" | "bugs";

// ─── Inline SVG Icons ──────────────────────────────────────────────────────────

const IcArrow = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);
const IcLock = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    <rect x="3" y="11" width="18" height="11" rx="3" />
    <circle cx="12" cy="16.5" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);
const IcMsg = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const IcServer = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" />
    <circle cx="6" cy="6" r="1" fill="currentColor" stroke="none" />
    <circle cx="6" cy="18" r="1" fill="currentColor" stroke="none" />
  </svg>
);
const IcPhone = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2.5" />
    <circle cx="12" cy="18.5" r="0.8" fill="currentColor" stroke="none" />
  </svg>
);
const IcTrash = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);
const IcFingerprint = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4" />
    <path d="M5 19.5C5.5 18 6 15 6 12c0-1.7.7-3.4 1.8-4.6" />
    <path d="M17.5 21.5c.5-1.5 1-3 1-4.5 0-1-.2-2-.5-3" />
    <path d="M12 12a2 2 0 1 1 4 0c0 2.5-1.5 5-2 6.5" />
    <path d="M10.5 8.5A5.5 5.5 0 0 1 17.5 14" />
    <path d="M8.5 12c0-3 2.3-5.5 5.5-5.5" />
  </svg>
);
const IcCheck = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IcMenu = ({ s = 22 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="4" y1="7" x2="20" y2="7" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="17" x2="20" y2="17" />
  </svg>
);
const IcClose = ({ s = 22 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IcApple = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);
const IcSend = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none" />
  </svg>
);

// ─── Vector Decorations ────────────────────────────────────────────────────────

// Orbital rings — overlapping ellipses at varying angles (hero)
const DecorOrbital = ({ opacity = 0.07 }: { opacity?: number }) => (
  <svg viewBox="0 0 900 900" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity }}>
    <ellipse cx="660" cy="360" rx="420" ry="180" stroke="#F4F4F3" strokeWidth="0.8" transform="rotate(-18 660 360)" />
    <ellipse cx="660" cy="360" rx="310" ry="130" stroke="#F4F4F3" strokeWidth="0.8" transform="rotate(22 660 360)" />
    <ellipse cx="660" cy="360" rx="210" ry="90" stroke="#F4F4F3" strokeWidth="0.8" transform="rotate(-8 660 360)" />
    <ellipse cx="660" cy="360" rx="490" ry="80" stroke="#F4F4F3" strokeWidth="0.6" transform="rotate(42 660 360)" />
    <circle cx="660" cy="360" r="6" fill="#F4F4F3" opacity="0.6" />
    <circle cx="660" cy="360" r="2.5" fill="#F4F4F3" />
    {/* orbit nodes */}
    <circle cx="310" cy="290" r="3" fill="#F4F4F3" opacity="0.4" />
    <circle cx="870" cy="480" r="2" fill="#F4F4F3" opacity="0.3" />
    <circle cx="530" cy="160" r="2.5" fill="#F4F4F3" opacity="0.35" />
    <circle cx="740" cy="560" r="2" fill="#F4F4F3" opacity="0.25" />
  </svg>
);

// Network mesh — sparse node graph (how-it-works / download)
const DecorMesh = ({ opacity = 0.06 }: { opacity?: number }) => (
  <svg viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity }}>
    {/* edges */}
    {[
      [80,80, 260,150],[260,150, 480,90],[480,90, 700,180],[260,150, 380,320],
      [380,320, 600,350],[600,350, 700,180],[380,320, 200,440],[200,440, 80,380],
      [80,380, 80,80],[600,350, 680,500],[200,440, 380,530],[380,530, 580,520],
      [480,90, 560,40],[700,180, 760,300],[760,300, 680,500],
    ].map(([x1,y1,x2,y2], i) => (
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#F4F4F3" strokeWidth="0.7" />
    ))}
    {/* nodes */}
    {[
      [80,80],[260,150],[480,90],[700,180],[380,320],[600,350],
      [200,440],[80,380],[680,500],[380,530],[580,520],[560,40],[760,300],
    ].map(([cx,cy], i) => (
      <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 3.5 : 2} fill="#F4F4F3" opacity={i % 3 === 0 ? 0.8 : 0.4} />
    ))}
  </svg>
);

// Flowing curves — bezier wave lines (quote / feature band)
const DecorWaves = ({ opacity = 0.055 }: { opacity?: number }) => (
  <svg viewBox="0 0 1200 300" fill="none" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity }}>
    <path d="M-60 220 C 120 140, 280 260, 440 180 S 700 80, 860 160 S 1060 240, 1260 140" stroke="#F4F4F3" strokeWidth="1" />
    <path d="M-60 160 C 140 100, 300 200, 480 130 S 720 40, 900 120 S 1080 200, 1260 100" stroke="#F4F4F3" strokeWidth="0.7" />
    <path d="M-60 280 C 100 200, 260 300, 420 230 S 680 130, 840 210 S 1040 290, 1260 200" stroke="#F4F4F3" strokeWidth="0.5" />
  </svg>
);

// Corner arc stack — radiating arcs from corner (section accent)
const DecorArcs = ({ opacity = 0.08 }: { opacity?: number }) => (
  <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", pointerEvents: "none", opacity }}>
    {[80, 140, 200, 260, 320, 380].map((r, i) => (
      <path key={i} d={`M0 ${r} A${r} ${r} 0 0 1 ${r} 0`} stroke="#F4F4F3" strokeWidth={i === 0 ? 1.2 : 0.7} />
    ))}
  </svg>
);

// Scattered dots — randomised dot field (subtle background texture)
const DecorDots = ({ opacity = 0.06 }: { opacity?: number }) => {
  const pts: [number, number, number][] = [
    [50,80,1.5],[150,30,1],[240,110,2],[380,60,1.2],[460,140,1],[560,50,1.8],
    [640,120,1],[700,30,1.3],[760,100,1],[820,70,1.5],[900,140,1.2],[960,50,1],
    [30,200,1],[120,260,1.5],[220,190,1],[310,280,1.2],[400,210,1.8],[520,270,1],
    [620,200,1.3],[720,260,1],[800,190,1.5],[880,240,1.2],[950,180,1],
  ];
  return (
    <svg viewBox="0 0 1000 300" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity }}>
      {pts.map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="#F4F4F3" />
      ))}
    </svg>
  );
};

// Cloud outlines — vintage engraving style cumulus silhouettes
const DecorCloudOutlines = ({ opacity = 0.12 }: { opacity?: number }) => (
  <svg viewBox="0 0 1440 700" fill="none" xmlns="http://www.w3.org/2000/svg"
    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity }}>
    {/* Large centre cloud */}
    <path d="M560 320 Q555 285 575 270 Q580 240 610 245 Q620 215 655 220 Q665 195 700 200 Q720 180 748 192 Q768 175 795 185 Q820 172 845 188 Q868 178 885 196 Q905 185 918 205 Q938 198 945 218 Q962 215 968 238 Q982 238 985 258 Q992 278 978 292 Q982 310 968 322 Q972 338 955 346 Q958 362 940 368 Q940 385 920 388 Q916 403 896 402 Q888 415 868 411 Q858 422 838 416 Q825 425 806 418 Q793 427 774 418 Q760 426 742 416 Q726 423 710 412 Q694 418 680 406 Q663 410 653 396 Q636 398 630 382 Q613 380 610 364 Q593 360 592 342 Q575 336 575 320 Z"
      stroke="#F4F4F3" strokeWidth="1.1" />
    {/* Inner cloud bumps — detail lines */}
    <path d="M620 280 Q635 265 660 270 M670 255 Q692 242 718 248 M735 238 Q758 228 778 238 M795 232 Q818 224 838 236 M855 238 Q872 232 882 248"
      stroke="#F4F4F3" strokeWidth="0.6" strokeLinecap="round" />
    <path d="M598 340 Q620 328 648 332 M665 320 Q690 310 720 318 M740 308 Q770 300 800 310 M818 305 Q845 298 868 310"
      stroke="#F4F4F3" strokeWidth="0.5" strokeLinecap="round" />

    {/* Small cloud — upper left */}
    <path d="M80 180 Q78 162 90 155 Q95 138 115 142 Q120 125 142 130 Q155 118 170 128 Q182 120 192 132 Q202 126 208 140 Q218 138 220 152 Q226 165 216 174 Q218 186 204 190 Q202 202 188 200 Q182 210 168 206 Q158 214 144 208 Q132 214 120 206 Q108 210 102 198 Q90 196 88 182 Z"
      stroke="#F4F4F3" strokeWidth="0.9" />
    <path d="M102 165 Q115 155 132 160 M145 148 Q160 140 172 150 M184 144 Q196 138 204 150"
      stroke="#F4F4F3" strokeWidth="0.5" strokeLinecap="round" />

    {/* Small cloud — upper right */}
    <path d="M1240 140 Q1238 120 1252 112 Q1258 94 1280 99 Q1287 82 1310 88 Q1325 76 1342 88 Q1356 80 1366 94 Q1378 90 1382 106 Q1390 118 1380 128 Q1382 142 1366 146 Q1364 158 1348 156 Q1340 166 1326 162 Q1314 170 1300 162 Q1288 168 1276 158 Q1264 162 1258 148 Q1246 144 1246 130 Z"
      stroke="#F4F4F3" strokeWidth="0.9" />
    <path d="M1258 122 Q1272 112 1290 118 M1302 104 Q1318 96 1332 106 M1346 100 Q1358 94 1364 108"
      stroke="#F4F4F3" strokeWidth="0.5" strokeLinecap="round" />

    {/* Medium cloud — right */}
    <path d="M1100 380 Q1097 355 1112 345 Q1118 322 1144 328 Q1152 306 1178 314 Q1190 295 1215 305 Q1232 292 1250 306 Q1266 296 1278 314 Q1292 308 1298 328 Q1310 328 1314 348 Q1320 365 1306 378 Q1310 396 1292 402 Q1290 418 1270 416 Q1262 428 1244 422 Q1232 432 1214 424 Q1198 432 1182 420 Q1166 426 1154 412 Q1138 414 1134 398 Q1118 394 1116 376 Z"
      stroke="#F4F4F3" strokeWidth="1" />
    <path d="M1122 362 Q1140 350 1164 356 M1178 340 Q1200 330 1222 338 M1240 330 Q1260 322 1278 334"
      stroke="#F4F4F3" strokeWidth="0.5" strokeLinecap="round" />

    {/* Tiny wispy clouds */}
    <path d="M300 100 Q298 88 308 84 Q314 72 328 76 Q336 66 350 72 Q360 66 366 76 Q372 82 364 90 Q366 100 354 102 Q350 110 338 106 Q326 112 316 104 Q306 106 302 96 Z"
      stroke="#F4F4F3" strokeWidth="0.7" />
    <path d="M820 80 Q818 68 830 64 Q836 52 852 56 Q860 46 876 52 Q888 46 896 58 Q902 68 892 76 Q894 88 878 90 Q872 100 858 94 Q844 100 832 90 Q820 90 820 78 Z"
      stroke="#F4F4F3" strokeWidth="0.7" />
    <path d="M1350 460 Q1348 448 1360 444 Q1366 432 1382 436 Q1390 426 1406 432 Q1418 426 1426 438 Q1432 448 1422 456 Q1424 468 1408 470 Q1402 480 1388 474 Q1374 480 1362 470 Q1350 470 1350 458 Z"
      stroke="#F4F4F3" strokeWidth="0.7" />
    <path d="M50 400 Q48 388 60 384 Q66 372 82 376 Q90 366 106 372 Q118 366 126 378 Q132 388 122 396 Q124 408 108 410 Q102 420 88 414 Q74 420 62 410 Q50 410 50 398 Z"
      stroke="#F4F4F3" strokeWidth="0.7" />

    {/* Medium cloud — lower left */}
    <path d="M180 460 Q177 438 194 428 Q200 408 226 415 Q235 394 262 402 Q276 386 298 398 Q315 386 330 400 Q344 392 352 410 Q365 408 369 428 Q377 445 362 458 Q366 475 348 480 Q345 494 326 491 Q318 503 300 497 Q287 506 270 498 Q255 504 240 494 Q225 500 214 486 Q199 484 196 468 Z"
      stroke="#F4F4F3" strokeWidth="1" />
    <path d="M202 448 Q220 436 244 442 M258 428 Q278 418 300 427 M316 418 Q335 410 350 422"
      stroke="#F4F4F3" strokeWidth="0.5" strokeLinecap="round" />

    {/* Small cloud — bottom centre */}
    <path d="M660 540 Q658 524 670 518 Q676 504 695 509 Q703 496 722 502 Q733 493 746 503 Q756 497 762 511 Q770 522 760 532 Q762 545 746 548 Q740 558 724 553 Q712 561 698 553 Q684 558 674 546 Q661 543 660 532 Z"
      stroke="#F4F4F3" strokeWidth="0.8" />
    <path d="M672 527 Q686 518 704 523 M716 510 Q732 503 744 514"
      stroke="#F4F4F3" strokeWidth="0.45" strokeLinecap="round" />

    {/* Large cloud — far left, partially visible */}
    <path d="M-60 280 Q-62 252 -44 242 Q-38 218 -10 224 Q-2 200 26 208 Q38 188 65 198 Q82 184 102 198 Q118 188 130 206 Q144 200 150 220 Q162 220 166 242 Q172 260 156 274 Q160 294 140 300 Q136 316 116 314 Q106 326 86 320 Q72 328 55 318 Q40 324 28 310 Q12 312 8 294 Q-8 290 -10 272 Q-28 266 -28 248 Z"
      stroke="#F4F4F3" strokeWidth="1" />
    <path d="M-8 264 Q12 252 38 258 M52 242 Q74 232 98 241 M112 230 Q130 222 146 234"
      stroke="#F4F4F3" strokeWidth="0.5" strokeLinecap="round" />

    {/* Tiny cloud cluster — upper centre */}
    <path d="M480 60 Q478 50 488 46 Q494 36 508 40 Q516 30 530 36 Q540 30 548 40 Q554 50 545 58 Q547 68 532 70 Q526 78 512 72 Q498 78 488 68 Q478 68 478 58 Z"
      stroke="#F4F4F3" strokeWidth="0.6" />
    <path d="M556 42 Q554 32 564 28 Q570 18 584 22 Q592 12 606 18 Q616 24 608 34 Q610 44 596 46 Q590 54 576 48 Q564 52 556 42 Z"
      stroke="#F4F4F3" strokeWidth="0.6" />

    {/* Wispy elongated cloud — mid right */}
    <path d="M1050 220 Q1055 208 1070 208 Q1080 196 1100 202 Q1114 192 1132 200 Q1148 192 1162 204 Q1176 198 1184 212 Q1194 220 1184 230 Q1188 242 1172 244 Q1166 254 1148 250 Q1136 258 1118 252 Q1102 258 1088 248 Q1072 250 1066 238 Q1054 234 1052 222 Z"
      stroke="#F4F4F3" strokeWidth="0.75" />
    <path d="M1068 220 Q1084 212 1104 218 M1118 208 Q1136 200 1154 210 M1168 204 Q1180 198 1186 212"
      stroke="#F4F4F3" strokeWidth="0.4" strokeLinecap="round" />

    {/* Tiny puff — lower right area */}
    <path d="M1180 560 Q1178 548 1190 543 Q1196 531 1213 536 Q1221 525 1238 531 Q1249 526 1256 538 Q1262 548 1252 557 Q1254 568 1238 571 Q1231 580 1216 575 Q1202 580 1192 569 Q1180 568 1180 557 Z"
      stroke="#F4F4F3" strokeWidth="0.7" />

    {/* Scattered small puffs */}
    <path d="M390 420 Q388 410 398 406 Q404 396 418 400 Q426 392 440 398 Q450 406 442 416 Q444 428 428 430 Q420 438 406 430 Q393 430 390 418 Z"
      stroke="#F4F4F3" strokeWidth="0.65" />
    <path d="M950 480 Q948 468 960 464 Q967 452 984 458 Q994 450 1010 458 Q1020 468 1010 478 Q1012 490 994 493 Q985 502 970 495 Q956 498 951 486 Z"
      stroke="#F4F4F3" strokeWidth="0.65" />
    <path d="M700 160 Q698 148 710 143 Q717 131 734 137 Q744 128 760 136 Q770 146 761 156 Q763 168 746 171 Q738 180 722 173 Q708 177 700 164 Z"
      stroke="#F4F4F3" strokeWidth="0.65" />

    {/* Horizon haze lines */}
    <line x1="0" y1="600" x2="1440" y2="600" stroke="#F4F4F3" strokeWidth="0.4" opacity="0.4" />
    <line x1="0" y1="628" x2="1440" y2="628" stroke="#F4F4F3" strokeWidth="0.3" opacity="0.25" />
    <line x1="0" y1="652" x2="1440" y2="652" stroke="#F4F4F3" strokeWidth="0.2" opacity="0.15" />
  </svg>
);

// Large abstract glyph — rotated geometric composition (download hero)
const DecorGlyph = ({ opacity = 0.06 }: { opacity?: number }) => (
  <svg viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", pointerEvents: "none", opacity }}>
    <rect x="100" y="100" width="400" height="400" stroke="#F4F4F3" strokeWidth="0.8" transform="rotate(15 300 300)" />
    <rect x="140" y="140" width="320" height="320" stroke="#F4F4F3" strokeWidth="0.8" transform="rotate(30 300 300)" />
    <rect x="180" y="180" width="240" height="240" stroke="#F4F4F3" strokeWidth="0.8" transform="rotate(45 300 300)" />
    <rect x="220" y="220" width="160" height="160" stroke="#F4F4F3" strokeWidth="0.8" transform="rotate(60 300 300)" />
    <circle cx="300" cy="300" r="8" fill="#F4F4F3" opacity="0.5" />
    <circle cx="300" cy="300" r="3" fill="#F4F4F3" />
    <circle cx="300" cy="300" r="120" stroke="#F4F4F3" strokeWidth="0.5" strokeDasharray="4 8" />
    <circle cx="300" cy="300" r="200" stroke="#F4F4F3" strokeWidth="0.4" strokeDasharray="2 10" />
  </svg>
);

// ─── Logo Mark (SVG from design file) ─────────────────────────────────────────

const LogoMark = ({ size = 36, fg = "#F4F4F3", bg = "#0B0B0C" }: { size?: number; fg?: string; bg?: string }) => (
  <svg viewBox="0 0 48 48" width={size} height={size} fill="none">
    <path d="M17 21 V15 a7 7 0 0 1 14 0 V21" stroke={fg} strokeWidth="3.4" strokeLinecap="round" />
    <rect x="9" y="21" width="30" height="17" rx="5.5" fill={fg} />
    <path d="M14.5 37 L11.5 43.2 L21 37.5 Z" fill={fg} />
    <circle cx="24" cy="28" r="3.1" fill={bg} />
    <path d="M22.5 29.7 L21.7 34 h4.6 l-0.8 -4.3 Z" fill={bg} />
  </svg>
);

const Wordmark = ({ className = "" }: { className?: string }) => (
  <span className={`font-semibold tracking-tight ${className}`} style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
    Chat<span style={{ color: "#5F5F5D" }}>2</span>Chat
  </span>
);

// ─── Mascot SVG (Locky, dark theme version) ────────────────────────────────────

const Mascot = ({ size = 260 }: { size?: number }) => {
  const stroke = "#F4F4F3";
  const body = "#1C1C1E";
  const eye = "#F4F4F3";
  const spark = "#0B0B0C";
  const blush = "#8A8A88";
  const ink = { stroke, fill: "none" as const, strokeWidth: 5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const thin = { stroke, fill: "none" as const, strokeWidth: 4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 260 280" width={size} style={{ height: "auto", overflow: "visible" }}>
      <ellipse cx="130" cy="258" rx="74" ry="11" fill={stroke} opacity="0.07" />
      <path d="M84 92 V70 a46 46 0 0 1 92 0 V92" {...ink} />
      <rect x="58" y="92" width="144" height="130" rx="30" fill={body} stroke={stroke} strokeWidth={5} />
      <path d="M58 150 q-26 4 -32 -18" {...ink} />
      <path d="M202 150 q30 -2 30 -34" {...ink} />
      <path d="M232 112 l7 -9" {...thin} />
      <path d="M239 122 l10 -5" {...thin} />
      <path d="M236 132 l9 1" {...thin} />
      <path d="M104 222 V244 M156 222 V244" {...ink} />
      <path d="M92 246 h24 M144 246 h24" {...ink} />
      <circle cx="106" cy="150" r="7.5" fill={eye} />
      <circle cx="154" cy="150" r="7.5" fill={eye} />
      <circle cx="109" cy="147" r="2.1" fill={spark} />
      <circle cx="157" cy="147" r="2.1" fill={spark} />
      <ellipse cx="86" cy="168" rx="9" ry="5" fill={blush} opacity="0.45" />
      <ellipse cx="174" cy="168" rx="9" ry="5" fill={blush} opacity="0.45" />
      <path d="M116 170 q14 14 28 0" {...thin} />
      <circle cx="130" cy="196" r="9" stroke={stroke} fill={body} strokeWidth={4} />
      <path d="M130 205 v8" stroke={stroke} strokeWidth={4} strokeLinecap="round" />
    </svg>
  );
};

// ─── Mascot light (for light card backgrounds) ────────────────────────────────

const MascotLight = ({ size = 260 }: { size?: number }) => {
  const ink = { stroke: "#1A1918", fill: "none" as const, strokeWidth: 5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const thin = { stroke: "#1A1918", fill: "none" as const, strokeWidth: 4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 260 280" width={size} style={{ height: "auto", overflow: "visible" }}>
      <ellipse cx="130" cy="258" rx="74" ry="11" fill="#1A1918" opacity="0.09" />
      <path d="M84 92 V70 a46 46 0 0 1 92 0 V92" {...ink} />
      <rect x="58" y="92" width="144" height="130" rx="30" fill="#FBFAF6" stroke="#1A1918" strokeWidth={5} />
      <path d="M58 150 q-26 4 -32 -18" {...ink} />
      <path d="M202 150 q30 -2 30 -34" {...ink} />
      <path d="M232 112 l7 -9" {...thin} /><path d="M239 122 l10 -5" {...thin} /><path d="M236 132 l9 1" {...thin} />
      <path d="M104 222 V244 M156 222 V244" {...ink} />
      <path d="M92 246 h24 M144 246 h24" {...ink} />
      <circle cx="106" cy="150" r="7.5" fill="#1A1918" /><circle cx="154" cy="150" r="7.5" fill="#1A1918" />
      <circle cx="109" cy="147" r="2.1" fill="#FBFAF6" /><circle cx="157" cy="147" r="2.1" fill="#FBFAF6" />
      <ellipse cx="86" cy="168" rx="9" ry="5" fill="#E8A98F" opacity="0.55" />
      <ellipse cx="174" cy="168" rx="9" ry="5" fill="#E8A98F" opacity="0.55" />
      <path d="M116 170 q14 14 28 0" {...thin} />
      <circle cx="130" cy="196" r="9" stroke="#1A1918" fill="#FBFAF6" strokeWidth={4} />
      <path d="M130 205 v8" stroke="#1A1918" strokeWidth={4} strokeLinecap="round" />
    </svg>
  );
};

// ─── Intro Animation ───────────────────────────────────────────────────────────

const IntroAnimation = ({ onDone }: { onDone: () => void }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 3600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0B0B0C]"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: "easeInOut" }}
    >
      <motion.div
        className="flex flex-col items-center gap-6"
        initial={{ opacity: 0, scale: 0.82 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      >
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        >
          <LogoMark size={72} />
        </motion.div>

        <motion.div
          className="flex flex-col items-center gap-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.45 }}
        >
          <span
            className="text-[42px] font-semibold tracking-tight text-[#F4F4F3] leading-none"
            style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
          >
            Chat<span style={{ color: "#5F5F5D" }}>2</span>Chat
          </span>
          <motion.span
            className="text-[13px] tracking-[0.18em] uppercase text-[#5F5F5D]"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85, duration: 0.5 }}
          >
            by Jobless
          </motion.span>
        </motion.div>
      </motion.div>

      <motion.button
        className="absolute bottom-10 text-[#3A3A3C] text-xs tracking-widest uppercase cursor-pointer bg-transparent border-0"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 0.4 }}
        onClick={onDone}
      >
        Skip
      </motion.button>
    </motion.div>
  );
};

// ─── Nav ───────────────────────────────────────────────────────────────────────

const LANGS = [
  { code: "EN", flag: "🇬🇧", name: "English" },
  { code: "RU", flag: "🇷🇺", name: "Русский" },
];

type Lang = "EN" | "RU";

const T: Record<Lang, Record<string, string>> = {
  EN: {
    // nav
    nav_home: "Home",
    nav_how: "How It Works",
    nav_app: "App",
    nav_download: "Download",
    nav_new: "What's New",
    nav_bugs: "Report Bug",
    nav_dl_btn: "Download",
    // intro
    skip: "Skip",
    // home
    home_badge: "Secure · Private · Encrypted",
    home_h1a: "A messenger",
    home_h1b: "built for",
    home_h1c: "privacy.",
    home_desc: "Chat2Chat is a powerful messenger with a custom encryption system. No email. No phone number. Just you and your conversations.",
    home_dl: "Download for iOS",
    home_how: "How it works",
    home_feat_label: "Core Principles",
    home_feat_h2: "Designed around\nyour privacy.",
    home_f1_t: "Custom Encryption",
    home_f1_d: "Built-in encryption system designed from the ground up. No third-party dependencies.",
    home_f2_t: "No Email or Phone",
    home_f2_d: "Your identity is a User ID and Fingerprint — both generated automatically on setup.",
    home_f3_t: "Zero Retention",
    home_f3_d: "Messages are deleted from the server the moment they are delivered. Nothing is stored.",
    home_f4_t: "Encrypted at Rest",
    home_f4_d: "While in transit, every message is encrypted. The server cannot read what you send.",
    home_marquee_label: "Private Messenger",
    home_marquee_sub: "Create an account in a few simple steps.\nDon't forget to remember your seed code.",
    home_locky_name: "Meet Locky",
    home_locky_sub: "Chat2Chat mascot",
    // how
    how_label: "Architecture",
    how_h1: "How it works.",
    how_p: "A message's journey from sender to recipient — and why nothing survives on the server.",
    how_step: "Step",
    how_s1_t: "You send a message",
    how_s1_d: "Write your message in Chat2Chat. The moment you hit send, it is encrypted on your device using our custom encryption system before leaving your phone.",
    how_s2_t: "Server stores it encrypted",
    how_s2_d: "The encrypted message travels to our server. The server holds only the encrypted payload — it cannot read the contents. No one can.",
    how_s3_t: "Recipient receives it",
    how_s3_d: "When the recipient opens the app, the message is delivered and decrypted on their device. It is then stored locally on their phone.",
    how_s4_t: "Server deletes the message",
    how_s4_d: "Once delivered, the message is permanently deleted from our server. We retain nothing. There is no server-side copy of your conversations.",
    how_id_t: "How you are identified",
    how_id_d: "To identify you, we use a User ID and a Fingerprint. Both are generated automatically when you create your account — no email, no phone number required. Your identity is cryptographically unique to your device.",
    how_seed_t: "Your seed code",
    how_seed_d: "During setup you will be given a seed code. This is the only way to recover your account. Write it down somewhere safe. We cannot recover it for you — it never leaves your device.",
    // app
    app_label: "App Screens",
    app_h1: "Simple. Clean.\nSecure.",
    app_p: "Everything you need. Nothing you don't. The interface is built around clarity and speed.",
    app_screen1: "Chat List",
    app_screen2: "Conversation",
    app_screen3: "Identity",
    app_c1_t: "Automatic Identity",
    app_c1_d: "User ID and Fingerprint are generated instantly. No forms, no verification codes.",
    app_c2_t: "Seed Code Backup",
    app_c2_d: "A 12-word seed code is your only account recovery method. Keep it offline.",
    app_c3_t: "Delivered & Deleted",
    app_c3_d: "Once received, messages are purged from our infrastructure. Permanently.",
    // download
    dl_label: "Download",
    dl_h1: "Get the app.",
    dl_p: "Currently available on iOS via AltStore. Mac is under development. Android coming soon.",
    dl_ios_status: "Available",
    dl_mac_status: "In Development",
    dl_and_status: "Coming Soon",
    dl_guide_h2: "Installation guide",
    dl_s1_t: "Install AltStore",
    dl_s1_d: "Download AltStore from altstore.io on your Mac or PC. Connect your iPhone via USB and trust your computer.",
    dl_s2_t: "Add Chat2Chat source",
    dl_s2_d: "Open AltStore on your iPhone. Go to Browse and add the Chat2Chat source URL to get the latest build.",
    dl_s3_t: "Install the app",
    dl_s3_d: "Find Chat2Chat in the Browse tab and tap Install. AltStore will sign and install the app directly to your device.",
    dl_s4_t: "Create your account",
    dl_s4_d: "Open Chat2Chat. Your User ID and Fingerprint are generated instantly. Write down your seed code before continuing.",
    dl_note: "AltStore is a third-party App Store alternative that allows you to install apps signed with your Apple ID without jailbreaking. It requires a free Apple Developer account and a Mac or PC running AltServer. Refresh apps every 7 days to keep them active.",
    dl_versions_h2: "Version history",
    // new
    new_label: "Changelog",
    new_h1: "What's new.",
    new_p: "Release history and updates for Chat2Chat.",
    new_tag_latest: "Latest",
    new_tag_initial: "Initial",
    new_type_new: "New",
    new_type_fix: "Fix",
    new_type_imp: "Improved",
    new_download: "Download IPA",
    new_build: "build",
    new_empty: "Nothing new",
    // bugs
    bugs_label: "Feedback",
    bugs_h1: "Report a bug.",
    bugs_p: "Help us improve Chat2Chat. Describe the issue and we will look into it.",
    bugs_type: "Type",
    bugs_title: "Title",
    bugs_desc_label: "Description",
    bugs_version: "App Version",
    bugs_device: "Device",
    bugs_ph_title: "Short description of the issue",
    bugs_ph_desc: "Steps to reproduce, what you expected, what happened",
    bugs_ph_ver: "e.g. 1.3.0",
    bugs_ph_dev: "e.g. iPhone 15 Pro",
    bugs_submit: "Submit Report",
    bugs_t1: "Bug",
    bugs_t2: "Crash",
    bugs_t3: "UI Issue",
    bugs_t4: "Other",
    bugs_success_h: "Report received",
    bugs_success_p: "Thank you. We will review your report and include fixes in an upcoming release.",
    bugs_another: "Submit another",
    // footer
    footer_desc: "A private messenger with custom encryption. By Jobless.",
    footer_copy: "2025 Chat2Chat — Jobless",
    footer_platforms: "iOS · macOS soon · Android soon",
  },
  RU: {
    // nav
    nav_home: "Главная",
    nav_how: "Как работает",
    nav_app: "Приложение",
    nav_download: "Скачать",
    nav_new: "Что нового",
    nav_bugs: "Сообщить об ошибке",
    nav_dl_btn: "Скачать",
    // intro
    skip: "Пропустить",
    // home
    home_badge: "Безопасно · Приватно · Зашифровано",
    home_h1a: "Мессенджер",
    home_h1b: "созданный для",
    home_h1c: "приватности.",
    home_desc: "Chat2Chat — мощный мессенджер с собственной системой шифрования. Без email. Без номера телефона. Только вы и ваши переписки.",
    home_dl: "Скачать для iOS",
    home_how: "Как это работает",
    home_feat_label: "Основные принципы",
    home_feat_h2: "Создан вокруг\nвашей приватности.",
    home_f1_t: "Собственное шифрование",
    home_f1_d: "Встроенная система шифрования, разработанная с нуля. Без сторонних зависимостей.",
    home_f2_t: "Без email и телефона",
    home_f2_d: "Ваша личность — это User ID и Fingerprint, оба генерируются автоматически при настройке.",
    home_f3_t: "Нулевое хранение",
    home_f3_d: "Сообщения удаляются с сервера сразу после доставки. Ничего не сохраняется.",
    home_f4_t: "Шифрование в покое",
    home_f4_d: "В процессе передачи каждое сообщение зашифровано. Сервер не может прочитать то, что вы отправляете.",
    home_marquee_label: "Приватный мессенджер",
    home_marquee_sub: "Создайте аккаунт за несколько простых шагов.\nНе забудьте запомнить свой сид-код.",
    home_locky_name: "Знакомьтесь, Локки",
    home_locky_sub: "Маскот Chat2Chat",
    // how
    how_label: "Архитектура",
    how_h1: "Как это работает.",
    how_p: "Путь сообщения от отправителя к получателю — и почему на сервере ничего не остаётся.",
    how_step: "Шаг",
    how_s1_t: "Вы отправляете сообщение",
    how_s1_d: "Напишите сообщение в Chat2Chat. В момент отправки оно шифруется на вашем устройстве с помощью нашей системы шифрования — до того, как покинет телефон.",
    how_s2_t: "Сервер хранит его зашифрованным",
    how_s2_d: "Зашифрованное сообщение поступает на наш сервер. Сервер хранит только зашифрованные данные — он не может прочитать содержимое. Никто не может.",
    how_s3_t: "Получатель получает его",
    how_s3_d: "Когда получатель открывает приложение, сообщение доставляется и расшифровывается на его устройстве. После этого оно хранится локально на телефоне.",
    how_s4_t: "Сервер удаляет сообщение",
    how_s4_d: "После доставки сообщение навсегда удаляется с нашего сервера. Мы ничего не храним. На сервере нет копии ваших переписок.",
    how_id_t: "Как вас идентифицируют",
    how_id_d: "Для идентификации мы используем User ID и Fingerprint. Оба генерируются автоматически при создании аккаунта — без email и номера телефона. Ваша личность криптографически уникальна для вашего устройства.",
    how_seed_t: "Ваш сид-код",
    how_seed_d: "При настройке вам будет выдан сид-код. Это единственный способ восстановить аккаунт. Запишите его в безопасном месте. Мы не можем восстановить его для вас — он никогда не покидает ваше устройство.",
    // app
    app_label: "Экраны приложения",
    app_h1: "Просто. Чисто.\nБезопасно.",
    app_p: "Всё, что нужно. Ничего лишнего. Интерфейс создан для ясности и скорости.",
    app_screen1: "Чаты",
    app_screen2: "Переписка",
    app_screen3: "Личность",
    app_c1_t: "Автоматическая личность",
    app_c1_d: "User ID и Fingerprint генерируются мгновенно. Без форм, без кодов подтверждения.",
    app_c2_t: "Резервный сид-код",
    app_c2_d: "12-словный сид-код — единственный способ восстановить аккаунт. Храните оффлайн.",
    app_c3_t: "Доставлено и удалено",
    app_c3_d: "После получения сообщения навсегда удаляются из нашей инфраструктуры.",
    // download
    dl_label: "Загрузка",
    dl_h1: "Скачайте приложение.",
    dl_p: "Доступно на iOS через AltStore. Mac в разработке. Android скоро.",
    dl_ios_status: "Доступно",
    dl_mac_status: "В разработке",
    dl_and_status: "Скоро",
    dl_guide_h2: "Руководство по установке",
    dl_s1_t: "Установите AltStore",
    dl_s1_d: "Скачайте AltStore с altstore.io на Mac или PC. Подключите iPhone через USB и доверьте компьютеру.",
    dl_s2_t: "Добавьте источник Chat2Chat",
    dl_s2_d: "Откройте AltStore на iPhone. Перейдите в Browse и добавьте URL источника Chat2Chat для получения последней сборки.",
    dl_s3_t: "Установите приложение",
    dl_s3_d: "Найдите Chat2Chat во вкладке Browse и нажмите «Установить». AltStore подпишет и установит приложение прямо на ваше устройство.",
    dl_s4_t: "Создайте аккаунт",
    dl_s4_d: "Откройте Chat2Chat. User ID и Fingerprint генерируются мгновенно. Запишите сид-код перед продолжением.",
    dl_note: "AltStore — это сторонняя альтернатива App Store, позволяющая устанавливать приложения, подписанные вашим Apple ID, без джейлбрейка. Требуется бесплатный аккаунт Apple Developer и Mac или PC с AltServer. Обновляйте приложения каждые 7 дней для активности.",
    dl_versions_h2: "История версий",
    // new
    new_label: "История изменений",
    new_h1: "Что нового.",
    new_p: "История релизов и обновлений Chat2Chat.",
    new_tag_latest: "Последнее",
    new_tag_initial: "Первый выпуск",
    new_type_new: "Новое",
    new_type_fix: "Исправление",
    new_type_imp: "Улучшение",
    new_download: "Скачать IPA",
    new_build: "сборка",
    new_empty: "Ничего нового",
    // bugs
    bugs_label: "Обратная связь",
    bugs_h1: "Сообщить об ошибке.",
    bugs_p: "Помогите нам улучшить Chat2Chat. Опишите проблему, и мы разберёмся.",
    bugs_type: "Тип",
    bugs_title: "Заголовок",
    bugs_desc_label: "Описание",
    bugs_version: "Версия приложения",
    bugs_device: "Устройство",
    bugs_ph_title: "Краткое описание проблемы",
    bugs_ph_desc: "Шаги для воспроизведения, что ожидалось, что произошло",
    bugs_ph_ver: "например, 1.3.0",
    bugs_ph_dev: "например, iPhone 15 Pro",
    bugs_submit: "Отправить отчёт",
    bugs_t1: "Баг",
    bugs_t2: "Вылет",
    bugs_t3: "Проблема UI",
    bugs_t4: "Другое",
    bugs_success_h: "Отчёт получен",
    bugs_success_p: "Спасибо. Мы рассмотрим ваш отчёт и включим исправления в следующий релиз.",
    bugs_another: "Отправить ещё",
    // footer
    footer_desc: "Приватный мессенджер с собственным шифрованием. By Jobless.",
    footer_copy: "2025 Chat2Chat — Jobless",
    footer_platforms: "iOS · macOS скоро · Android скоро",
  },
};

const getNavLinks = (lang: Lang): { id: Page; label: string }[] => [
  { id: "home",     label: T[lang].nav_home },
  { id: "how",      label: T[lang].nav_how },
  { id: "app",      label: T[lang].nav_app },
  { id: "download", label: T[lang].nav_download },
  { id: "new",      label: T[lang].nav_new },
  { id: "bugs",     label: T[lang].nav_bugs },
];

const Nav = ({ page, setPage, lang, setLang }: { page: Page; setPage: (p: Page) => void; lang: Lang; setLang: (l: Lang) => void }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const activeLang = LANGS.find((l) => l.code === lang) ?? LANGS[0];
  const setActiveLang = (l: typeof LANGS[number]) => setLang(l.code as Lang);
  const navLinks = getNavLinks(lang);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const go = (p: Page) => { setPage(p); setMobileOpen(false); window.scrollTo({ top: 0 }); };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-3">

          {/* Logo bubble */}
          <button
            onClick={() => go("home")}
            className="flex items-center gap-2.5 cursor-pointer border-0 p-0 shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)",
              backdropFilter: "blur(28px) saturate(160%)",
              WebkitBackdropFilter: "blur(28px) saturate(160%)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 999,
              padding: "8px 16px 8px 10px",
              boxShadow: "0 2px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.13), inset 0 -1px 0 rgba(0,0,0,0.15)",
            }}
          >
            <LogoMark size={26} />
            <Wordmark className="text-[15px] text-[#F4F4F3]" />
          </button>

          {/* Desktop nav links bubble */}
          <div
            className="hidden md:flex items-center gap-0.5"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)",
              backdropFilter: "blur(28px) saturate(160%)",
              WebkitBackdropFilter: "blur(28px) saturate(160%)",
              border: "1px solid rgba(255,255,255,0.11)",
              borderRadius: 999,
              padding: "5px 6px",
              boxShadow: "0 2px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.12)",
            }}
          >
            {navLinks.slice(1, -1).map((l) => (
              <button
                key={l.id}
                onClick={() => go(l.id)}
                className="relative px-4 py-2 text-[13px] rounded-full cursor-pointer border-0"
                style={{
                  fontFamily: "'Hanken Grotesk', sans-serif",
                  color: page === l.id ? "#F4F4F3" : "#9C9C9A",
                  background: "transparent",
                  transition: "color 0.2s",
                  zIndex: 1,
                }}
              >
                {page === l.id && (
                  <motion.div
                    layoutId="nav-slider"
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.25)",
                      zIndex: -1,
                    }}
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  />
                )}
                <span style={{ position: "relative" }}>{l.label}</span>
              </button>
            ))}
          </div>

          {/* Right side — download bubble + lang switcher + mobile hamburger */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Download bubble — desktop */}
            <button
              onClick={() => go("download")}
              className="hidden md:flex items-center gap-2 text-[13px] font-medium cursor-pointer border-0 transition-all duration-200"
              style={{
                background: "linear-gradient(135deg, rgba(244,244,243,0.95) 0%, rgba(220,220,218,0.9) 100%)",
                color: "#0B0B0C",
                fontFamily: "'Hanken Grotesk', sans-serif",
                borderRadius: 999,
                padding: "9px 18px",
                boxShadow: "0 2px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(0,0,0,0.1)",
              }}
            >
              <IcApple s={14} />
              {T[lang].nav_dl_btn}
            </button>

            {/* Language switcher — desktop */}
            <div className="hidden md:block relative">
              <motion.button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center justify-center cursor-pointer border-0"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 999,
                  background: langOpen
                    ? "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.07) 100%)"
                    : "linear-gradient(135deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.03) 100%)",
                  backdropFilter: "blur(28px) saturate(160%)",
                  WebkitBackdropFilter: "blur(28px) saturate(160%)",
                  border: "1px solid rgba(255,255,255,0.13)",
                  boxShadow: "0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12)",
                  fontSize: 20,
                  lineHeight: 1,
                  transition: "background 0.2s",
                }}
                whileTap={{ scale: 0.9 }}
              >
                <div style={{ position: "relative", width: 22, height: 22, overflow: "hidden" }}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={activeLang.code}
                      initial={{ y: "100%", opacity: 0 }}
                      animate={{ y: "0%", opacity: 1 }}
                      exit={{ y: "-100%", opacity: 0 }}
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        lineHeight: 1,
                      }}
                    >
                      {activeLang.flag}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </motion.button>

              <AnimatePresence>
                {langOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    style={{
                      position: "absolute",
                      top: "calc(100% + 10px)",
                      right: 0,
                      minWidth: 180,
                      borderRadius: 16,
                      padding: "6px",
                      background: "linear-gradient(135deg, rgba(18,18,20,0.82) 0%, rgba(11,11,12,0.75) 100%)",
                      backdropFilter: "blur(40px) saturate(180%)",
                      WebkitBackdropFilter: "blur(40px) saturate(180%)",
                      border: "1px solid rgba(255,255,255,0.13)",
                      boxShadow: "0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.10)",
                      zIndex: 100,
                    }}
                  >
                    {LANGS.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setActiveLang(lang);
                          setTimeout(() => setLangOpen(false), 280);
                        }}
                        className="relative flex items-center gap-3 w-full cursor-pointer border-0 text-left"
                        style={{
                          padding: "9px 12px",
                          borderRadius: 10,
                          fontFamily: "'Hanken Grotesk', sans-serif",
                          fontSize: 13,
                          color: activeLang.code === lang.code ? "#F4F4F3" : "#9C9C9A",
                          background: "transparent",
                        }}
                      >
                        {activeLang.code === lang.code && (
                          <motion.div
                            layoutId="lang-selector"
                            className="absolute inset-0"
                            style={{ borderRadius: 10, background: "rgba(255,255,255,0.11)" }}
                            transition={{ type: "spring", stiffness: 480, damping: 38 }}
                          />
                        )}
                        <span style={{ position: "relative", fontSize: 18, lineHeight: 1 }}>{lang.flag}</span>
                        <span style={{ position: "relative", flex: 1 }}>{lang.name}</span>
                        <span style={{
                          position: "relative",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10,
                          letterSpacing: "0.1em",
                          color: activeLang.code === lang.code ? "#9C9C9A" : "#5F5F5D",
                        }}>{lang.code}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Language switcher — mobile */}
            <div className="md:hidden relative">
              <motion.button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center justify-center cursor-pointer border-0"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 999,
                  background: langOpen
                    ? "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.07) 100%)"
                    : "linear-gradient(135deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.03) 100%)",
                  backdropFilter: "blur(28px) saturate(160%)",
                  WebkitBackdropFilter: "blur(28px) saturate(160%)",
                  border: "1px solid rgba(255,255,255,0.13)",
                  boxShadow: "0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12)",
                  transition: "background 0.2s",
                }}
                whileTap={{ scale: 0.9 }}
              >
                <div style={{ position: "relative", width: 22, height: 22, overflow: "hidden" }}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={activeLang.code}
                      initial={{ y: "100%", opacity: 0 }}
                      animate={{ y: "0%", opacity: 1 }}
                      exit={{ y: "-100%", opacity: 0 }}
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        lineHeight: 1,
                      }}
                    >
                      {activeLang.flag}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </motion.button>

              <AnimatePresence>
                {langOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    style={{
                      position: "absolute",
                      top: "calc(100% + 10px)",
                      right: 0,
                      minWidth: 180,
                      borderRadius: 16,
                      padding: "6px",
                      background: "linear-gradient(135deg, rgba(18,18,20,0.92) 0%, rgba(11,11,12,0.88) 100%)",
                      backdropFilter: "blur(40px) saturate(180%)",
                      WebkitBackdropFilter: "blur(40px) saturate(180%)",
                      border: "1px solid rgba(255,255,255,0.13)",
                      boxShadow: "0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.10)",
                      zIndex: 100,
                    }}
                  >
                    {LANGS.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setActiveLang(lang);
                          setTimeout(() => setLangOpen(false), 280);
                        }}
                        className="relative flex items-center gap-3 w-full cursor-pointer border-0 text-left"
                        style={{
                          padding: "9px 12px",
                          borderRadius: 10,
                          fontFamily: "'Hanken Grotesk', sans-serif",
                          fontSize: 13,
                          color: activeLang.code === lang.code ? "#F4F4F3" : "#9C9C9A",
                          background: "transparent",
                        }}
                      >
                        {activeLang.code === lang.code && (
                          <motion.div
                            layoutId="lang-selector-mobile"
                            className="absolute inset-0"
                            style={{ borderRadius: 10, background: "rgba(255,255,255,0.11)" }}
                            transition={{ type: "spring", stiffness: 480, damping: 38 }}
                          />
                        )}
                        <span style={{ position: "relative", fontSize: 18, lineHeight: 1 }}>{lang.flag}</span>
                        <span style={{ position: "relative", flex: 1 }}>{lang.name}</span>
                        <span style={{
                          position: "relative",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10,
                          letterSpacing: "0.1em",
                          color: activeLang.code === lang.code ? "#9C9C9A" : "#5F5F5D",
                        }}>{lang.code}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile hamburger bubble */}
            <motion.button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden flex items-center justify-center cursor-pointer border-0"
              style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                background: "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)",
                backdropFilter: "blur(28px) saturate(160%)",
                WebkitBackdropFilter: "blur(28px) saturate(160%)",
                border: "1px solid rgba(255,255,255,0.13)",
                boxShadow: "0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12)",
                color: "#F4F4F3",
                overflow: "hidden",
              }}
              whileTap={{ scale: 0.9 }}
            >
              <div style={{ position: "relative", width: 18, height: 18 }}>
                <AnimatePresence mode="wait">
                  {!mobileOpen ? (
                    <motion.div
                      key="bars"
                      style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}
                      initial={{ y: 14, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 14, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.32, 0, 0.67, 0] }}
                    >
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          style={{ display: "block", height: 1.6, background: "#F4F4F3", borderRadius: 2, width: i === 2 ? "65%" : "100%" }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.04 }}
                        />
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="x"
                      style={{ position: "absolute", inset: 0 }}
                      initial={{ y: -14, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -14, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.33, 1, 0.68, 1] }}
                    >
                      <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="#F4F4F3" strokeWidth="1.6" strokeLinecap="round">
                        <line x1="3" y1="3" x2="15" y2="15" />
                        <line x1="15" y1="3" x2="3" y2="15" />
                      </svg>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 flex flex-col"
            style={{ background: "#0B0B0C" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex-1 pt-20 px-5 flex flex-col gap-1 overflow-y-auto">
              {navLinks.map((l, i) => (
                <motion.button
                  key={l.id}
                  onClick={() => go(l.id)}
                  className="text-left px-4 py-4 rounded-xl cursor-pointer bg-transparent border-0"
                  style={{
                    fontFamily: "'Hanken Grotesk', sans-serif",
                    fontSize: 20,
                    fontWeight: 500,
                    color: page === l.id ? "#F4F4F3" : "#5F5F5D",
                    background: page === l.id ? "rgba(244,244,243,0.06)" : "transparent",
                  }}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.2 }}
                  whileTap={{ scale: 0.94, x: 8, backgroundColor: "rgba(244,244,243,0.1)", transition: { duration: 0.12 } }}
                >
                  {l.label}
                </motion.button>
              ))}
            </div>
            <div className="px-5 pb-10 pt-4 border-t border-[rgba(244,244,243,0.07)]">
              <button
                onClick={() => go("download")}
                className="w-full py-4 rounded-xl font-semibold text-[16px] cursor-pointer border-0 flex items-center justify-center gap-2.5"
                style={{ background: "#F4F4F3", color: "#0B0B0C", fontFamily: "'Hanken Grotesk', sans-serif" }}
              >
                <IcApple s={18} />
                {T[lang].home_dl}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// ─── Phone Mockup Component ────────────────────────────────────────────────────

const PhoneFrame = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <div className="flex flex-col items-center gap-4">
    <div
      className="relative"
      style={{
        width: 220,
        background: "#111113",
        borderRadius: 36,
        border: "1px solid rgba(244,244,243,0.12)",
        boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(244,244,243,0.05) inset",
        overflow: "hidden",
        padding: "12px 8px 16px",
      }}
    >
      {/* notch */}
      <div className="flex justify-center mb-2">
        <div style={{ width: 80, height: 26, background: "#0B0B0C", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1C1C1E" }} />
          <div style={{ width: 40, height: 10, borderRadius: 5, background: "#1C1C1E" }} />
        </div>
      </div>
      <div style={{ height: 420, overflow: "hidden", borderRadius: 24 }}>{children}</div>
    </div>
    <span className="text-[11px] tracking-[0.14em] uppercase" style={{ color: "#5F5F5D", fontFamily: "'JetBrains Mono', monospace" }}>
      {label}
    </span>
  </div>
);

// Screen: Chat List
const ScreenChatList = () => (
  <div style={{ background: "#0B0B0C", height: "100%", display: "flex", flexDirection: "column", fontFamily: "'Hanken Grotesk', sans-serif" }}>
    <div style={{ padding: "16px 14px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 18, fontWeight: 600, color: "#F4F4F3" }}>Messages</span>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1C1C1E", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <IcMsg s={13} />
      </div>
    </div>
    <div style={{ padding: "0 14px 8px" }}>
      <div style={{ background: "#1C1C1E", borderRadius: 10, padding: "7px 10px", display: "flex", alignItems: "center", gap: 6 }}>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#5F5F5D" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <span style={{ fontSize: 12, color: "#5F5F5D" }}>Search</span>
      </div>
    </div>
    {[
      { id: "usr_8K29mX", preview: "Got it, message received.", time: "Now", unread: 2 },
      { id: "usr_3T71zQ", preview: "See you tomorrow", time: "2m", unread: 0 },
      { id: "usr_6P44nL", preview: "Encrypted message", time: "1h", unread: 1 },
      { id: "usr_9A02fR", preview: "Done", time: "3h", unread: 0 },
    ].map((c) => (
      <div key={c.id} style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(244,244,243,0.04)" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1C1C1E", border: "1px solid rgba(244,244,243,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <IcLock s={14} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#F4F4F3", fontFamily: "'JetBrains Mono', monospace" }}>{c.id}</span>
            <span style={{ fontSize: 10, color: "#5F5F5D" }}>{c.time}</span>
          </div>
          <span style={{ fontSize: 11, color: "#9C9C9A", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.preview}</span>
        </div>
        {c.unread > 0 && (
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#F4F4F3", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 9, color: "#0B0B0C", fontWeight: 700 }}>{c.unread}</span>
          </div>
        )}
      </div>
    ))}
  </div>
);

// Screen: Conversation
const ScreenConversation = () => (
  <div style={{ background: "#0B0B0C", height: "100%", display: "flex", flexDirection: "column", fontFamily: "'Hanken Grotesk', sans-serif" }}>
    <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(244,244,243,0.06)" }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#1C1C1E", border: "1px solid rgba(244,244,243,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <IcLock s={13} />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#F4F4F3", fontFamily: "'JetBrains Mono', monospace" }}>usr_8K29mX</div>
        <div style={{ fontSize: 9, color: "#5F5F5D", display: "flex", alignItems: "center", gap: 3 }}>
          <IcLock s={8} />
          End-to-end encrypted
        </div>
      </div>
    </div>
    <div style={{ flex: 1, padding: "12px 12px", display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
      {[
        { me: false, text: "Hey, can you send the file?", time: "14:21" },
        { me: true, text: "Sure, one second", time: "14:22" },
        { me: false, text: "No rush", time: "14:22" },
        { me: true, text: "Sent. Message deleted from server.", time: "14:23" },
      ].map((m, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.me ? "flex-end" : "flex-start" }}>
          <div style={{
            background: m.me ? "#F4F4F3" : "#1C1C1E",
            color: m.me ? "#0B0B0C" : "#F4F4F3",
            padding: "6px 10px",
            borderRadius: m.me ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
            fontSize: 11,
            maxWidth: "80%",
            lineHeight: 1.4,
          }}>{m.text}</div>
          <span style={{ fontSize: 9, color: "#5F5F5D", marginTop: 2 }}>{m.time}</span>
        </div>
      ))}
    </div>
    <div style={{ padding: "8px 10px", borderTop: "1px solid rgba(244,244,243,0.06)", display: "flex", gap: 6, alignItems: "center" }}>
      <div style={{ flex: 1, background: "#1C1C1E", borderRadius: 20, padding: "7px 12px" }}>
        <span style={{ fontSize: 11, color: "#5F5F5D" }}>Message</span>
      </div>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#F4F4F3", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <IcSend s={12} />
      </div>
    </div>
  </div>
);

// Screen: Identity
const ScreenIdentity = () => (
  <div style={{ background: "#0B0B0C", height: "100%", fontFamily: "'Hanken Grotesk', sans-serif", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
    <div>
      <span style={{ fontSize: 18, fontWeight: 600, color: "#F4F4F3" }}>Your Identity</span>
      <p style={{ fontSize: 10, color: "#5F5F5D", marginTop: 4 }}>Created automatically. Never shared.</p>
    </div>
    <div style={{ background: "#111113", borderRadius: 14, padding: "14px", border: "1px solid rgba(244,244,243,0.08)" }}>
      <div style={{ fontSize: 9, color: "#5F5F5D", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>User ID</div>
      <div style={{ fontSize: 11, color: "#F4F4F3", fontFamily: "'JetBrains Mono', monospace", wordBreak: "break-all", lineHeight: 1.5 }}>usr_8K29mX4fZqP2nRvLwY</div>
    </div>
    <div style={{ background: "#111113", borderRadius: 14, padding: "14px", border: "1px solid rgba(244,244,243,0.08)" }}>
      <div style={{ fontSize: 9, color: "#5F5F5D", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>Fingerprint</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
        {["A4F2", "9C1B", "E7D3", "2K8M", "P5X0", "R3N6", "W1Q9", "J4T7"].map((c) => (
          <div key={c} style={{ background: "#1C1C1E", borderRadius: 6, padding: "4px", textAlign: "center", fontSize: 9, color: "#9C9C9A", fontFamily: "'JetBrains Mono', monospace" }}>{c}</div>
        ))}
      </div>
    </div>
    <div style={{ background: "#111113", borderRadius: 14, padding: "14px", border: "1px solid rgba(244,244,243,0.08)" }}>
      <div style={{ fontSize: 9, color: "#5F5F5D", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" }}>Seed Code</div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {Array(12).fill(0).map((_, i) => (
          <div key={i} style={{ background: "#1C1C1E", borderRadius: 5, padding: "4px 6px", fontSize: 9, color: "#5F5F5D", fontFamily: "'JetBrains Mono', monospace", filter: "blur(3px)" }}>word</div>
        ))}
      </div>
      <p style={{ fontSize: 9, color: "#5F5F5D", marginTop: 8 }}>Your seed code is blurred for security. Tap to reveal.</p>
    </div>
  </div>
);

// ─── Page: Home ────────────────────────────────────────────────────────────────

const HomePage = ({ setPage, lang }: { setPage: (p: Page) => void; lang: Lang }) => {
  const t = T[lang];
  const feats = [
    { icon: <IcLock s={18} />, title: t.home_f1_t, desc: t.home_f1_d },
    { icon: <IcFingerprint s={18} />, title: t.home_f2_t, desc: t.home_f2_d },
    { icon: <IcTrash s={18} />, title: t.home_f3_t, desc: t.home_f3_d },
    { icon: <IcServer s={18} />, title: t.home_f4_t, desc: t.home_f4_d },
  ];

  return (
    <div style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
      {/* Hero */}
      <section className="min-h-screen flex flex-col justify-center relative overflow-hidden pt-20">
        {/* Cloud outlines */}
        <DecorCloudOutlines opacity={0.18} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(244,244,243,0.03) 0%, transparent 70%)" }} />
        {/* orbital rings decoration — right half */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none overflow-hidden">
          <DecorOrbital opacity={0.09} />
        </div>
        {/* corner arcs — top left */}
        <div className="absolute top-0 left-0 w-[280px] h-[280px] pointer-events-none overflow-hidden opacity-40">
          <DecorArcs opacity={0.12} />
        </div>

        <div className="max-w-7xl mx-auto px-5 md:px-6 py-16 md:py-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative">
          {/* Text */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
            <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[rgba(244,244,243,0.12)] text-[11px] tracking-[0.16em] uppercase text-[#5F5F5D]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <IcLock s={11} />
              {t.home_badge}
            </div>
            <h1 className="text-[clamp(42px,7vw,88px)] font-semibold leading-[0.95] tracking-tight text-[#F4F4F3] mb-5">
              {t.home_h1a}<br />
              <span style={{ color: "#5F5F5D" }}>{t.home_h1b}</span><br />
              {t.home_h1c}
            </h1>
            <p className="text-[16px] md:text-[17px] leading-relaxed text-[#9C9C9A] max-w-[440px] mb-8">
              {lang === "RU"
                ? "Chat2Chat передаёт только шифротекст, а потом забывает его. Ваши переписки живут на ваших устройствах — никогда на наших серверах. Личность — это ключ, которым управляете вы, а не аккаунт, который принадлежит нам."
                : "Chat2Chat relays only ciphertext, then forgets it. Your conversations live on your devices — never on our servers. Identity is a key you control, not an account we own."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setPage("download")}
                className="inline-flex items-center justify-center gap-2.5 px-6 py-4 sm:py-3.5 rounded-xl font-medium text-[15px] cursor-pointer border-0 transition-all duration-200 hover:opacity-85 w-full sm:w-auto"
                style={{ background: "#F4F4F3", color: "#0B0B0C" }}
              >
                <IcApple s={16} />
                {t.home_dl}
              </button>
              <button
                onClick={() => setPage("how")}
                className="inline-flex items-center justify-center gap-2.5 px-6 py-4 sm:py-3.5 rounded-xl font-medium text-[15px] cursor-pointer transition-all duration-200 hover:bg-[rgba(244,244,243,0.06)] w-full sm:w-auto"
                style={{ background: "transparent", color: "#F4F4F3", border: "1px solid rgba(244,244,243,0.15)" }}
              >
                {t.home_how}
                <IcArrow s={15} />
              </button>
            </div>
          </motion.div>

          {/* Mascot card — desktop only */}
          <motion.div
            className="hidden lg:flex justify-center"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          >
            <div
              className="relative"
              style={{
                background: "#F6F4EE",
                borderRadius: 32,
                padding: "48px 40px 32px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 20,
                boxShadow: "0 80px 120px rgba(0,0,0,0.5), 0 0 0 1px rgba(244,244,243,0.05) inset",
              }}
            >
              <MascotLight size={220} />
              <div className="text-center">
                <p className="text-[13px] font-semibold text-[#1A1918]">{t.home_locky_name}</p>
                <p className="text-[11px] text-[#8A867C] mt-1">{t.home_locky_sub}</p>
              </div>
              <div className="absolute top-4 right-4 flex gap-2">
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#DED9CE" }} />
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#DED9CE" }} />
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#DED9CE" }} />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[#3A3A3C]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
        >
          <motion.div
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <svg width={16} height={24} viewBox="0 0 16 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="2" y="2" width="12" height="20" rx="6" />
              <line x1="8" y1="7" x2="8" y2="11" />
            </svg>
          </motion.div>
        </motion.div>
      </section>

      {/* Feature grid */}
      <section className="max-w-7xl mx-auto px-5 md:px-6 py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <DecorMesh opacity={0.055} />
        </div>
        <div className="mb-14">
          <div className="text-[11px] tracking-[0.18em] uppercase text-[#5F5F5D] mb-4" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.home_feat_label}</div>
          <h2 className="text-[clamp(28px,4vw,48px)] font-semibold tracking-tight text-[#F4F4F3]">{t.home_feat_h2.split("\n").map((line, i, arr) => i < arr.length - 1 ? <span key={i}>{line}<br /></span> : <span key={i}>{line}</span>)}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {feats.map((f, i) => (
            <motion.div
              key={i}
              className="p-6 rounded-2xl border border-[rgba(244,244,243,0.07)] bg-[#111113] flex flex-col gap-4 hover:border-[rgba(244,244,243,0.15)] transition-colors duration-200"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.5 }}
            >
              <div className="text-[#9C9C9A]">{f.icon}</div>
              <div>
                <h3 className="text-[15px] font-semibold text-[#F4F4F3] mb-2">{f.title}</h3>
                <p className="text-[13px] leading-relaxed text-[#5F5F5D]">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Quote band */}
      <section className="relative border-t border-b border-[rgba(244,244,243,0.07)] overflow-hidden" style={{ minHeight: 360 }}>
        <div className="flex flex-col items-center justify-center text-center px-6 py-24 md:py-32">
          <div className="mb-6 text-[11px] tracking-[0.22em] uppercase" style={{ color: "rgba(244,244,243,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>
            {t.home_marquee_label}
          </div>
          <div style={{ overflow: "hidden", width: "100vw", position: "relative", left: "50%", transform: "translateX(-50%)" }}>
            <style>{`
              @keyframes c2c-marquee {
                0%   { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
            `}</style>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
              animation: "c2c-marquee 400s linear infinite",
              width: "max-content",
              whiteSpace: "nowrap",
            }}>
              {[
                { word: ["Chat", "2", "Chat"],   script: "EN" },
                { word: ["Чат", "2", "Чат"],     script: "RU" },
                { word: ["チャット", "2", "チャット"], script: "JP" },
                { word: ["聊天", "2", "聊天"],   script: "ZH" },
                { word: ["채팅", "2", "채팅"],   script: "KO" },
                { word: ["دردشة", "2", "دردشة"], script: "AR" },
                { word: ["चैट", "2", "चैट"],    script: "HI" },
                { word: ["แชท", "2", "แชท"],    script: "TH" },
                { word: ["ჩათ", "2", "ჩათ"],    script: "KA" },
                { word: ["צ'אט", "2", "צ'אט"],  script: "HE" },
                { word: ["Τσατ", "2", "Τσατ"],  script: "EL" },
                { word: ["Chat", "2", "Chat"],   script: "FR" },
              ].flatMap((item, _, arr) => [...arr, ...arr]).map((item, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "baseline" }}>
                  <span style={{
                    fontSize: "clamp(48px, 8vw, 110px)",
                    fontWeight: 600,
                    letterSpacing: "-0.03em",
                    color: "#F4F4F3",
                    fontFamily: "'Hanken Grotesk', sans-serif",
                    lineHeight: 1,
                    textShadow: "0 4px 40px rgba(30,100,180,0.2)",
                  }}>
                    {item.word[0]}
                    <span style={{ color: "rgba(244,244,243,0.28)" }}>{item.word[1]}</span>
                    {item.word[2]}
                  </span>
                  <span style={{
                    margin: "0 clamp(20px, 3vw, 52px)",
                    fontSize: "clamp(20px, 3vw, 40px)",
                    color: "rgba(244,244,243,0.15)",
                    fontWeight: 300,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: 0,
                  }}>·</span>
                </span>
              ))}
            </div>
          </div>
          <motion.p
            className="mt-6 text-[15px] md:text-[17px] font-light"
            style={{ color: "rgba(244,244,243,0.4)", maxWidth: 440, lineHeight: 1.65 }}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.7 }}
          >
            {t.home_marquee_sub.split("\n").map((line, i, arr) => i < arr.length - 1 ? <span key={i}>{line}<br /></span> : <span key={i}>{line}</span>)}
          </motion.p>
        </div>
      </section>
    </div>
  );
};

// ─── Page: How It Works ────────────────────────────────────────────────────────

const HowPage = ({ lang }: { lang: Lang }) => {
  const t = T[lang];
  const steps = [
    { n: "01", icon: <IcMsg s={24} />, title: t.how_s1_t, desc: t.how_s1_d },
    { n: "02", icon: <IcServer s={24} />, title: t.how_s2_t, desc: t.how_s2_d },
    { n: "03", icon: <IcPhone s={24} />, title: t.how_s3_t, desc: t.how_s3_d },
    { n: "04", icon: <IcTrash s={24} />, title: t.how_s4_t, desc: t.how_s4_d },
  ];

  return (
    <div className="pt-20" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
      <div className="max-w-7xl mx-auto px-5 md:px-6 py-14 md:py-20 relative overflow-hidden">
        {/* mesh decor — top right corner */}
        <div className="absolute -right-20 -top-10 w-[500px] h-[400px] pointer-events-none">
          <DecorMesh opacity={0.06} />
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative">
          <div className="text-[11px] tracking-[0.18em] uppercase text-[#5F5F5D] mb-5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.how_label}</div>
          <h1 className="text-[clamp(32px,5vw,68px)] font-semibold tracking-tight text-[#F4F4F3] mb-4">{t.how_h1}</h1>
          <p className="text-[15px] md:text-[17px] text-[#9C9C9A] max-w-xl">{t.how_p}</p>
        </motion.div>

        {/* Steps */}
        <div className="mt-20 relative">
          {/* vertical connector line */}
          <div className="hidden lg:block absolute left-[calc(50%-1px)] top-0 bottom-0 w-px" style={{ background: "linear-gradient(to bottom, transparent, rgba(244,244,243,0.1) 10%, rgba(244,244,243,0.1) 90%, transparent)" }} />

          <div className="flex flex-col gap-6">
            {steps.map((s, i) => (
              <motion.div
                key={i}
                className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Content block */}
                <div className={`p-6 md:p-8 rounded-2xl border border-[rgba(244,244,243,0.08)] bg-[#111113] ${i % 2 === 1 ? "lg:order-2" : ""}`}>
                  <div className="flex items-start gap-5">
                    <div className="text-[#F4F4F3] mt-1">{s.icon}</div>
                    <div>
                      <div className="text-[11px] tracking-[0.16em] uppercase text-[#5F5F5D] mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.how_step} {s.n}</div>
                      <h3 className="text-[22px] font-semibold tracking-tight text-[#F4F4F3] mb-3">{s.title}</h3>
                      <p className="text-[15px] leading-relaxed text-[#9C9C9A]">{s.desc}</p>
                    </div>
                  </div>
                </div>

                {/* Number bubble — center connector */}
                <div className={`hidden lg:flex justify-center items-center ${i % 2 === 1 ? "lg:order-1" : ""}`}>
                  <div
                    className="w-14 h-14 rounded-full border border-[rgba(244,244,243,0.15)] flex items-center justify-center"
                    style={{ background: "#0B0B0C", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#5F5F5D" }}
                  >
                    {s.n}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Identity info */}
        <motion.div
          className="mt-24 grid grid-cols-1 md:grid-cols-2 gap-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="p-8 rounded-2xl bg-[#111113] border border-[rgba(244,244,243,0.08)]">
            <IcFingerprint s={22} />
            <h3 className="text-[20px] font-semibold text-[#F4F4F3] mt-4 mb-2">{t.how_id_t}</h3>
            <p className="text-[14px] leading-relaxed text-[#9C9C9A]">
              {t.how_id_d}
            </p>
          </div>
          <div className="p-8 rounded-2xl bg-[#111113] border border-[rgba(244,244,243,0.08)]">
            <IcLock s={22} />
            <h3 className="text-[20px] font-semibold text-[#F4F4F3] mt-4 mb-2">{t.how_seed_t}</h3>
            <p className="text-[14px] leading-relaxed text-[#9C9C9A]">
              {t.how_seed_d}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// ─── Page: App ─────────────────────────────────────────────────────────────────

const AppScreenSlider = ({ lang }: { lang: Lang }) => {
  const t = T[lang];
  const screens = [
    { screen: <ScreenChatList />,    label: t.app_screen1 },
    { screen: <ScreenConversation />, label: t.app_screen2 },
    { screen: <ScreenIdentity />,    label: t.app_screen3 },
  ];
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState(1);

  const go = (idx: number) => {
    setDir(idx > active ? 1 : -1);
    setActive(idx);
  };

  return (
    <>
      {/* ── Desktop: all 3 screens side by side ── */}
      <div className="hidden md:flex justify-center gap-10 mt-20">
        {screens.map((s, i) => (
          <motion.div
            key={i}
            className="flex flex-col items-center gap-3"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{ marginTop: i === 1 ? 40 : 0 }}
          >
            <div style={{ width: 260, height: 480, borderRadius: 20, overflow: "hidden", border: "1px solid rgba(244,244,243,0.1)" }}>
              {s.screen}
            </div>
            <span className="text-[11px] tracking-[0.14em] uppercase" style={{ color: "#5F5F5D", fontFamily: "'JetBrains Mono', monospace" }}>
              {s.label}
            </span>
          </motion.div>
        ))}
      </div>

      {/* ── Mobile: single screen + tab switcher ── */}
      <div className="md:hidden flex flex-col items-center gap-6 mt-12">
        <div style={{ width: 260, height: 480, position: "relative", overflow: "hidden", borderRadius: 20, border: "1px solid rgba(244,244,243,0.1)" }}>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={active}
              custom={dir}
              style={{ position: "absolute", inset: 0 }}
              initial={{ x: dir * 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: dir * -60, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.32, 0, 0.67, 0] }}
            >
              {screens[active].screen}
            </motion.div>
          </AnimatePresence>
        </div>

        <div
          className="flex items-center gap-1"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
            backdropFilter: "blur(28px) saturate(160%)",
            WebkitBackdropFilter: "blur(28px) saturate(160%)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 999,
            padding: "5px 6px",
            boxShadow: "0 2px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.09)",
          }}
        >
          {screens.map((s, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              className="relative px-5 py-2 text-[13px] rounded-full cursor-pointer border-0"
              style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: active === i ? "#F4F4F3" : "#5F5F5D", background: "transparent", transition: "color 0.2s" }}
            >
              {active === i && (
                <motion.div
                  layoutId="screen-tab-slider"
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.07) 100%)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 8px rgba(0,0,0,0.25)",
                    zIndex: -1,
                  }}
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              )}
              <span style={{ position: "relative" }}>{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

const AppPage = ({ lang }: { lang: Lang }) => {
  const t = T[lang];
  return (
  <div className="pt-20" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
    <div className="max-w-7xl mx-auto px-5 md:px-6 py-16 md:py-20">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div className="text-[11px] tracking-[0.18em] uppercase text-[#5F5F5D] mb-5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.app_label}</div>
        <h1 className="text-[clamp(32px,5vw,68px)] font-semibold tracking-tight text-[#F4F4F3] mb-4">{t.app_h1.split("\n").map((line, i, arr) => i < arr.length - 1 ? <span key={i}>{line}<br /></span> : <span key={i}>{line}</span>)}</h1>
        <p className="text-[15px] md:text-[17px] text-[#9C9C9A] max-w-lg">{t.app_p}</p>
      </motion.div>

      {/* Screens — horizontal scroll on mobile, centered row on desktop */}
      <AppScreenSlider lang={lang} />

      {/* Callouts below phones */}
      <div className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "01", title: t.app_c1_t, desc: t.app_c1_d },
          { label: "02", title: t.app_c2_t, desc: t.app_c2_d },
          { label: "03", title: t.app_c3_t, desc: t.app_c3_d },
        ].map((c, i) => (
          <motion.div
            key={i}
            className="p-6 rounded-2xl border border-[rgba(244,244,243,0.07)] bg-[#111113]"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
          >
            <div className="text-[11px] tracking-[0.16em] uppercase text-[#5F5F5D] mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{c.label}</div>
            <h3 className="text-[16px] font-semibold text-[#F4F4F3] mb-2">{c.title}</h3>
            <p className="text-[13px] leading-relaxed text-[#5F5F5D]">{c.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
  );
};

// ─── Page: Download ────────────────────────────────────────────────────────────

const DownloadPage = ({ lang }: { lang: Lang }) => {
  const t = T[lang];
  const releases = getPublicReleases();
  const steps = [
    { n: "1", title: t.dl_s1_t, desc: t.dl_s1_d },
    { n: "2", title: t.dl_s2_t, desc: t.dl_s2_d },
    { n: "3", title: t.dl_s3_t, desc: t.dl_s3_d },
    { n: "4", title: t.dl_s4_t, desc: t.dl_s4_d },
  ];

  const [iosPopup, setIosPopup] = useState<null | "choice" | "manual">(null);

  const manualSteps = [
    {
      n: "00",
      title: lang === "RU" ? "Режим разработчика" : "Developer Mode",
      desc: lang === "RU"
        ? "Перейдите в Настройки → Конфиденциальность и безопасность → Режим разработчика и включите его. Перезагрузитесь при появлении запроса."
        : "Go to Settings → Privacy & Security → Developer Mode and enable it. Restart when prompted.",
    },
    {
      n: "01",
      title: lang === "RU" ? "Скачайте AltServer" : "Get AltServer",
      desc: lang === "RU"
        ? "Скачайте AltServer с altstore.io, перетащите в Программы и запустите — его значок появится в строке меню."
        : "Download AltServer from altstore.io, drag it into Applications, then launch it — its icon will appear in the menu bar.",
    },
    {
      n: "02",
      title: lang === "RU" ? "Подключите iPhone и установите AltStore" : "Connect & Install AltStore",
      desc: lang === "RU"
        ? "Подключите iPhone к Mac, нажмите «Доверять этому компьютеру», затем в строке меню: AltServer → Install AltStore → выберите устройство."
        : "Plug iPhone into Mac, tap \"Trust This Computer\", then via menu bar: AltServer → Install AltStore → select device.",
    },
    {
      n: "03",
      title: lang === "RU" ? "Подождите AltStore" : "Wait for AltStore",
      desc: lang === "RU"
        ? "Введите данные Apple ID при запросе. AltStore появится на главном экране примерно через минуту."
        : "Enter Apple ID credentials when asked. AltStore should appear on the home screen within roughly one minute.",
    },
    {
      n: "04",
      title: lang === "RU" ? "Скачайте IPA" : "Get the IPA",
      desc: lang === "RU"
        ? "Скачайте через Safari на iPhone или на Mac с AirDrop. Прямая ссылка: api.chat2chat.org/altstore/Chat2Chat-latest.ipa"
        : "Download via Safari (iPhone) or Mac + AirDrop. Direct link: api.chat2chat.org/altstore/Chat2Chat-latest.ipa",
    },
    {
      n: "05",
      title: lang === "RU" ? "Установите через AltStore" : "Sideload It",
      desc: lang === "RU"
        ? "В AltStore: Мои приложения → + → выберите IPA. Или откройте файл в Файлах → Поделиться → Открыть в AltStore. Если приложение не запускается: Настройки → Основные → VPN и управление устройством → доверьте Apple ID."
        : "In AltStore: My Apps → + → select the IPA. Or open the file in Files → Share → Open in AltStore. If it won't launch: Settings → General → VPN & Device Management → trust your Apple ID.",
    },
  ];

  return (
    <div className="pt-20" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>

      {/* ── iOS install modal ── */}
      <AnimatePresence>
        {iosPopup && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setIosPopup(null)}
          >
            {/* backdrop */}
            <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }} />

            <motion.div
              className="relative w-full sm:max-w-lg mx-4 mb-4 sm:mb-0"
              initial={{ y: 40, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                borderRadius: 24,
                background: "linear-gradient(145deg, rgba(20,20,22,0.96) 0%, rgba(11,11,12,0.96) 100%)",
                backdropFilter: "blur(40px) saturate(180%)",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.10)",
                overflow: "hidden",
              }}
            >
              {/* ── Choice screen ── */}
              <AnimatePresence mode="wait">
                {iosPopup === "choice" && (
                  <motion.div
                    key="choice"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.22 }}
                    className="p-8"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <div className="text-[11px] tracking-[0.16em] uppercase text-[#5F5F5D] mb-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>iOS</div>
                        <h2 className="text-[22px] font-semibold text-[#F4F4F3]">
                          {lang === "RU" ? "Как установить?" : "How to install?"}
                        </h2>
                      </div>
                      <button
                        onClick={() => setIosPopup(null)}
                        className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-0"
                        style={{ background: "rgba(255,255,255,0.08)", color: "#9C9C9A" }}
                      >
                        <IcClose s={16} />
                      </button>
                    </div>

                    <div className="flex flex-col gap-3">
                      {/* AltStore option */}
                      <motion.button
                        onClick={() => window.open("altstore://source?url=https%3A%2F%2Fapi.chat2chat.org%2Faltstore%2Fsource.json", "_blank")}
                        className="w-full flex items-center gap-5 p-5 rounded-2xl cursor-pointer border-0 text-left group"
                        style={{ background: "#F4F4F3", color: "#0B0B0C" }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#0B0B0C", color: "#F4F4F3" }}>
                          <IcApple s={20} />
                        </div>
                        <div className="flex-1">
                          <div className="text-[15px] font-semibold">Open in AltStore</div>
                          <div className="text-[12px] mt-0.5" style={{ color: "#5F5F5D", fontFamily: "'JetBrains Mono', monospace" }}>
                            {lang === "RU" ? "Нужен AltStore на устройстве" : "Requires AltStore installed"}
                          </div>
                        </div>
                        <IcArrow s={16} />
                      </motion.button>

                      {/* Manual option */}
                      <motion.button
                        onClick={() => setIosPopup("manual")}
                        className="w-full flex items-center gap-5 p-5 rounded-2xl cursor-pointer border-0 text-left"
                        style={{ background: "#111113", color: "#F4F4F3", border: "1px solid rgba(244,244,243,0.1)" }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#1C1C1E" }}>
                          <IcLock s={18} />
                        </div>
                        <div className="flex-1">
                          <div className="text-[15px] font-semibold">
                            {lang === "RU" ? "Ручная установка" : "Manual Install"}
                          </div>
                          <div className="text-[12px] mt-0.5" style={{ color: "#5F5F5D", fontFamily: "'JetBrains Mono', monospace" }}>
                            {lang === "RU" ? "Пошаговая инструкция" : "Step-by-step guide"}
                          </div>
                        </div>
                        <IcArrow s={16} />
                      </motion.button>
                    </div>

                    <p className="mt-5 text-[11px] text-center" style={{ color: "#3A3A3C", fontFamily: "'JetBrains Mono', monospace" }}>
                      {lang === "RU" ? "Только iOS · Без джейлбрейка" : "iOS only · No jailbreak required"}
                    </p>
                  </motion.div>
                )}

                {/* ── Manual install guide ── */}
                {iosPopup === "manual" && (
                  <motion.div
                    key="manual"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.22 }}
                    className="p-8 max-h-[80vh] overflow-y-auto"
                    style={{ scrollbarWidth: "none" }}
                  >
                    <div className="flex items-center gap-3 mb-7">
                      <button
                        onClick={() => setIosPopup("choice")}
                        className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-0 shrink-0"
                        style={{ background: "rgba(255,255,255,0.08)", color: "#9C9C9A" }}
                      >
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 12H5M12 5l-7 7 7 7" />
                        </svg>
                      </button>
                      <div>
                        <div className="text-[11px] tracking-[0.16em] uppercase text-[#5F5F5D]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {lang === "RU" ? "Ручная установка" : "Manual Install"}
                        </div>
                        <h2 className="text-[18px] font-semibold text-[#F4F4F3]">
                          {lang === "RU" ? "Установка через AltStore" : "Sideload via AltStore"}
                        </h2>
                      </div>
                      <button
                        onClick={() => setIosPopup(null)}
                        className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-0 ml-auto shrink-0"
                        style={{ background: "rgba(255,255,255,0.08)", color: "#9C9C9A" }}
                      >
                        <IcClose s={16} />
                      </button>
                    </div>

                    <div className="flex flex-col gap-3">
                      {manualSteps.map((s, i) => (
                        <motion.div
                          key={i}
                          className="flex gap-4 p-4 rounded-xl"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05, duration: 0.3 }}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-semibold mt-0.5"
                            style={{ background: "#1C1C1E", color: "#9C9C9A", fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            {s.n}
                          </div>
                          <div>
                            <div className="text-[13px] font-semibold text-[#F4F4F3] mb-1">{s.title}</div>
                            <p className="text-[12px] leading-relaxed text-[#9C9C9A]">{s.desc}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* IPA direct download */}
                    <div className="mt-5 p-4 rounded-xl" style={{ background: "rgba(244,244,243,0.05)", border: "1px solid rgba(244,244,243,0.1)" }}>
                      <div className="text-[10px] tracking-[0.14em] uppercase text-[#5F5F5D] mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {lang === "RU" ? "Прямая ссылка IPA" : "Direct IPA link"}
                      </div>
                      <button
                        onClick={() => window.open("https://api.chat2chat.org/altstore/Chat2Chat-latest.ipa", "_blank")}
                        className="w-full flex items-center justify-between cursor-pointer border-0 text-left"
                        style={{ background: "transparent", color: "#F4F4F3" }}
                      >
                        <span className="text-[11px] text-[#9C9C9A]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          api.chat2chat.org/altstore/Chat2Chat-latest.ipa
                        </span>
                        <IcArrow s={13} />
                      </button>
                    </div>

                    <p className="mt-4 text-[11px] text-center" style={{ color: "#3A3A3C", fontFamily: "'JetBrains Mono', monospace" }}>
                      {lang === "RU" ? "Переподписывайте каждые 7 дней через AltServer в той же Wi-Fi сети" : "Re-sign every 7 days with AltServer on the same Wi-Fi"}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-5 md:px-6 py-14 md:py-20 relative overflow-hidden">
        {/* rotated glyph — right side background */}
        <div className="absolute -right-32 top-0 w-[520px] h-[520px] pointer-events-none">
          <DecorGlyph opacity={0.065} />
        </div>
        {/* arcs — bottom left */}
        <div className="absolute -left-8 bottom-0 w-[300px] h-[300px] pointer-events-none">
          <DecorArcs opacity={0.07} />
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative">
          <div className="text-[11px] tracking-[0.18em] uppercase text-[#5F5F5D] mb-5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.dl_label}</div>
          <h1 className="text-[clamp(36px,5vw,68px)] font-semibold tracking-tight text-[#F4F4F3] mb-4">{t.dl_h1}</h1>
          <p className="text-[17px] text-[#9C9C9A] max-w-lg">{t.dl_p}</p>
        </motion.div>

        {/* Platform badges */}
        <div className="mt-12 flex flex-wrap gap-4">
          {[
            { platform: "iOS", status: t.dl_ios_status, icon: <IcApple s={22} />, active: true },
            { platform: "macOS", status: t.dl_mac_status, icon: <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6zm0 4h8v2H6zm10 0h2v2h-2zm-6-4h8v2h-8z" /></svg>, active: false },
            { platform: "Android", status: t.dl_and_status, icon: <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor"><path d="M17.523 15.341A5 5 0 0 0 19 12a5 5 0 0 0-1.477-3.341L18.5 7.5l-1.5-1.5-1.159 1.159A5 5 0 0 0 12 6a5 5 0 0 0-3.841 1.159L7 6 5.5 7.5l.977 1.159A5 5 0 0 0 5 12a5 5 0 0 0 1.477 3.341L5.5 16.5 7 18l1.159-1.159A5 5 0 0 0 12 18a5 5 0 0 0 3.841-1.159L17 18l1.5-1.5-0.977-1.159zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm-1-6h2v2h-2z" /></svg>, active: false },
          ].map((p) => (
            <motion.div
              key={p.platform}
              className="flex items-center gap-4 px-6 py-4 rounded-2xl border"
              style={{
                background: p.active ? "#F4F4F3" : "#111113",
                color: p.active ? "#0B0B0C" : "#5F5F5D",
                borderColor: p.active ? "#F4F4F3" : "rgba(244,244,243,0.08)",
                minWidth: 180,
                cursor: p.active ? "pointer" : "default",
              }}
              onClick={p.active ? () => setIosPopup("choice") : undefined}
              whileTap={p.active ? { scale: 0.97 } : undefined}
            >
              <div>{p.icon}</div>
              <div>
                <div className="text-[15px] font-semibold">{p.platform}</div>
                <div className="text-[11px] mt-0.5" style={{ color: p.active ? "#5F5F5D" : "#3A3A3C", fontFamily: "'JetBrains Mono', monospace" }}>{p.status}</div>
              </div>
              {p.active && (
                <div className="ml-auto">
                  <IcArrow s={14} />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Installation steps */}
        <div className="mt-20">
          <h2 className="text-[28px] font-semibold text-[#F4F4F3] mb-10">{t.dl_guide_h2}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {steps.map((s, i) => (
              <motion.div
                key={i}
                className="p-7 rounded-2xl bg-[#111113] border border-[rgba(244,244,243,0.08)] flex gap-5"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[13px] font-semibold"
                  style={{ background: "#1C1C1E", color: "#F4F4F3", fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {s.n}
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-[#F4F4F3] mb-2">{s.title}</h3>
                  <p className="text-[13px] leading-relaxed text-[#9C9C9A]">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Version history */}
        <div className="mt-20">
          <h2 className="text-[28px] font-semibold text-[#F4F4F3] mb-10">{t.dl_versions_h2}</h2>
          <div className="flex flex-col gap-4">
            {releases.map((release, i) => (
              <motion.article
                key={`${release.version}-${release.buildVersion}`}
                className="p-7 rounded-2xl border border-[rgba(244,244,243,0.08)] flex flex-col gap-5 md:flex-row md:items-start md:justify-between bg-[#111113]"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: release.deprecated && !release.isLatest ? 0.82 : 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.5 }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="text-[20px] font-semibold text-[#F4F4F3]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      v{release.version}
                    </span>
                    {release.isLatest && (
                      <span
                        className="px-2.5 py-0.5 rounded-md text-[11px] font-medium"
                        style={{ background: "#F4F4F3", color: "#0B0B0C" }}
                      >
                        {t.new_tag_latest}
                      </span>
                    )}
                    <span className="text-[12px] text-[#5F5F5D]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {t.new_build} {release.buildVersion} · {release.date}
                    </span>
                  </div>
                  <p className="text-[14px] leading-relaxed text-[#9C9C9A] m-0">{release.description}</p>
                </div>
                <motion.a
                  href={release.downloadUrl}
                  className="inline-flex items-center justify-center gap-2 shrink-0 px-5 py-3 rounded-xl text-[14px] font-semibold no-underline"
                  style={{
                    background: release.isLatest ? "#F4F4F3" : "transparent",
                    color: release.isLatest ? "#0B0B0C" : "#F4F4F3",
                    border: release.isLatest ? "none" : "1px solid rgba(244,244,243,0.16)",
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  <IcApple s={16} />
                  {t.new_download}
                </motion.a>
              </motion.article>
            ))}
          </div>
        </div>

        {/* Altstore note */}
        <motion.div
          className="mt-12 p-6 rounded-2xl border border-[rgba(244,244,243,0.1)] bg-[#111113] flex gap-4 items-start"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <div className="text-[#5F5F5D] mt-0.5"><IcLock s={16} /></div>
          <div>
            <p className="text-[13px] leading-relaxed text-[#9C9C9A]">
              {t.dl_note}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// ─── Page: What's New ─────────────────────────────────────────────────────────

const NewPage = ({ lang }: { lang: Lang }) => {
  const t = T[lang];

  return (
    <div className="pt-20" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
      <div className="max-w-5xl mx-auto px-6 py-20 relative overflow-hidden min-h-[50vh]">
        <div className="absolute inset-0 pointer-events-none">
          <DecorDots opacity={0.06} />
        </div>
        <div className="absolute -right-4 -top-4 w-[260px] h-[260px] pointer-events-none" style={{ transform: "rotate(180deg)" }}>
          <DecorArcs opacity={0.08} />
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative">
          <div className="text-[11px] tracking-[0.18em] uppercase text-[#5F5F5D] mb-5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.new_label}</div>
          <h1 className="text-[clamp(36px,5vw,68px)] font-semibold tracking-tight text-[#F4F4F3] mb-4">{t.new_h1}</h1>
          <p className="text-[17px] text-[#9C9C9A]">{t.new_empty}</p>
        </motion.div>
      </div>
    </div>
  );
};

// ─── Page: Bugs ────────────────────────────────────────────────────────────────

const BugsPage = ({ lang }: { lang: Lang }) => {
  const t = T[lang];
  const bugTypes = [
    { code: "Bug", label: t.bugs_t1 },
    { code: "Crash", label: t.bugs_t2 },
    { code: "UI Issue", label: t.bugs_t3 },
    { code: "Other", label: t.bugs_t4 },
  ];
  const [form, setForm] = useState({ type: "Bug", title: "", desc: "", version: "", device: "" });
  const [sent, setSent] = useState(false);

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="pt-20" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
      <div className="max-w-3xl mx-auto px-6 py-20 relative overflow-hidden">
        {/* glyph in background */}
        <div className="absolute -right-40 -top-20 w-[480px] h-[480px] pointer-events-none">
          <DecorGlyph opacity={0.05} />
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative">
          <div className="text-[11px] tracking-[0.18em] uppercase text-[#5F5F5D] mb-5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.bugs_label}</div>
          <h1 className="text-[clamp(36px,5vw,68px)] font-semibold tracking-tight text-[#F4F4F3] mb-4">{t.bugs_h1}</h1>
          <p className="text-[17px] text-[#9C9C9A] max-w-lg">{t.bugs_p}</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div
              key="thanks"
              className="mt-16 p-12 rounded-2xl bg-[#111113] border border-[rgba(244,244,243,0.08)] flex flex-col items-center gap-5 text-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <div className="w-14 h-14 rounded-full border border-[rgba(244,244,243,0.15)] flex items-center justify-center text-[#F4F4F3]">
                <IcCheck s={24} />
              </div>
              <h2 className="text-[22px] font-semibold text-[#F4F4F3]">{t.bugs_success_h}</h2>
              <p className="text-[14px] text-[#9C9C9A] max-w-sm">{t.bugs_success_p}</p>
              <button
                onClick={() => { setSent(false); setForm({ type: "Bug", title: "", desc: "", version: "", device: "" }); }}
                className="mt-2 px-6 py-3 rounded-xl text-[14px] font-medium cursor-pointer border-0 transition-all hover:opacity-80"
                style={{ background: "#1C1C1E", color: "#F4F4F3" }}
              >
                {t.bugs_another}
              </button>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={handle}
              className="mt-16 flex flex-col gap-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              {/* Type selector */}
              <div>
                <label className="block text-[12px] tracking-[0.12em] uppercase text-[#5F5F5D] mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.bugs_type}</label>
                <div className="flex gap-2">
                  {bugTypes.map((bt) => (
                    <button
                      key={bt.code}
                      type="button"
                      onClick={() => setForm({ ...form, type: bt.code })}
                      className="px-4 py-2 rounded-xl text-[13px] font-medium cursor-pointer border transition-all"
                      style={{
                        background: form.type === bt.code ? "#F4F4F3" : "#111113",
                        color: form.type === bt.code ? "#0B0B0C" : "#9C9C9A",
                        borderColor: form.type === bt.code ? "#F4F4F3" : "rgba(244,244,243,0.1)",
                      }}
                    >
                      {bt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-[12px] tracking-[0.12em] uppercase text-[#5F5F5D] mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.bugs_title}</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={t.bugs_ph_title}
                  className="w-full px-4 py-3.5 rounded-xl text-[14px] outline-none transition-all"
                  style={{
                    background: "#111113",
                    color: "#F4F4F3",
                    border: "1px solid rgba(244,244,243,0.1)",
                    fontFamily: "'Hanken Grotesk', sans-serif",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(244,244,243,0.3)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(244,244,243,0.1)"; }}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[12px] tracking-[0.12em] uppercase text-[#5F5F5D] mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.bugs_desc_label}</label>
                <textarea
                  required
                  rows={5}
                  value={form.desc}
                  onChange={(e) => setForm({ ...form, desc: e.target.value })}
                  placeholder={t.bugs_ph_desc}
                  className="w-full px-4 py-3.5 rounded-xl text-[14px] outline-none resize-none transition-all"
                  style={{
                    background: "#111113",
                    color: "#F4F4F3",
                    border: "1px solid rgba(244,244,243,0.1)",
                    fontFamily: "'Hanken Grotesk', sans-serif",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(244,244,243,0.3)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(244,244,243,0.1)"; }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Version */}
                <div>
                  <label className="block text-[12px] tracking-[0.12em] uppercase text-[#5F5F5D] mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.bugs_version}</label>
                  <input
                    value={form.version}
                    onChange={(e) => setForm({ ...form, version: e.target.value })}
                    placeholder={t.bugs_ph_ver}
                    className="w-full px-4 py-3.5 rounded-xl text-[14px] outline-none transition-all"
                    style={{
                      background: "#111113",
                      color: "#F4F4F3",
                      border: "1px solid rgba(244,244,243,0.1)",
                      fontFamily: "'Hanken Grotesk', sans-serif",
                    }}
                    onFocus={(e) => { e.target.style.borderColor = "rgba(244,244,243,0.3)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "rgba(244,244,243,0.1)"; }}
                  />
                </div>
                {/* Device */}
                <div>
                  <label className="block text-[12px] tracking-[0.12em] uppercase text-[#5F5F5D] mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.bugs_device}</label>
                  <input
                    value={form.device}
                    onChange={(e) => setForm({ ...form, device: e.target.value })}
                    placeholder={t.bugs_ph_dev}
                    className="w-full px-4 py-3.5 rounded-xl text-[14px] outline-none transition-all"
                    style={{
                      background: "#111113",
                      color: "#F4F4F3",
                      border: "1px solid rgba(244,244,243,0.1)",
                      fontFamily: "'Hanken Grotesk', sans-serif",
                    }}
                    onFocus={(e) => { e.target.style.borderColor = "rgba(244,244,243,0.3)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "rgba(244,244,243,0.1)"; }}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="mt-3 w-full py-4 rounded-xl text-[15px] font-semibold cursor-pointer border-0 transition-all hover:opacity-85 flex items-center justify-center gap-2"
                style={{ background: "#F4F4F3", color: "#0B0B0C" }}
              >
                {t.bugs_submit}
                <IcArrow s={16} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── Footer ────────────────────────────────────────────────────────────────────

const Footer = ({ setPage, lang }: { setPage: (p: Page) => void; lang: Lang }) => {
  const t = T[lang];
  const navLinks = getNavLinks(lang);
  return (
  <footer className="border-t border-[rgba(244,244,243,0.07)] py-16 mt-16" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
    <div className="max-w-7xl mx-auto px-5 md:px-6">
      <div className="flex flex-col md:flex-row justify-between items-start gap-10">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <LogoMark size={26} />
            <Wordmark className="text-[15px] text-[#F4F4F3]" />
          </div>
          <p className="text-[13px] text-[#5F5F5D] max-w-[260px] leading-relaxed">{t.footer_desc}</p>
        </div>
        <div
          className="flex flex-wrap items-center gap-0.5"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
            backdropFilter: "blur(28px) saturate(160%)",
            WebkitBackdropFilter: "blur(28px) saturate(160%)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 999,
            padding: "5px 6px",
            boxShadow: "0 2px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.09), inset 0 -1px 0 rgba(0,0,0,0.10)",
          }}
        >
          {[navLinks[0], navLinks[navLinks.length - 1]].map((l) => (
            <button
              key={l.id}
              onClick={() => { setPage(l.id); window.scrollTo({ top: 0 }); }}
              className="px-4 py-2 text-[13px] rounded-full cursor-pointer border-0 transition-colors duration-150"
              style={{
                fontFamily: "'Hanken Grotesk', sans-serif",
                color: "#5F5F5D",
                background: "transparent",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#F4F4F3")}
              onMouseLeave={e => (e.currentTarget.style.color = "#5F5F5D")}
            >
              {l.label}
            </button>
          ))}
        </div>

      </div>
      <div className="mt-10 pt-6 border-t border-[rgba(244,244,243,0.05)] flex justify-between items-center flex-wrap gap-4">
        <span className="text-[11px] text-[#3A3A3C]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.footer_copy}</span>
        <span className="text-[11px] text-[#3A3A3C]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.footer_platforms}</span>
      </div>
    </div>
  </footer>
  );
};

// ─── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [showIntro, setShowIntro] = useState(true);
  const [introExiting, setIntroExiting] = useState(false);
  const [activeLang, setActiveLang] = useState<Lang>("EN");

  const handleIntroDone = () => {
    setIntroExiting(true);
    setTimeout(() => setShowIntro(false), 700);
  };

  return (
    <div className="min-h-screen text-foreground relative" style={{ fontFamily: "'Hanken Grotesk', sans-serif", background: "#0B0B0C" }}>

      {/* ── Global fixed background ── */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        {/* Cloud image — blurred, blue */}
        <div style={{
          position: "absolute",
          inset: "-30px",
          backgroundImage: `url(${cloudsBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundAttachment: "fixed",
          filter: "blur(22px)",
          opacity: 0.38,
        }} />
        {/* Heavy dark veil so content is always readable */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to bottom, rgba(11,11,12,0.62) 0%, rgba(11,11,12,0.52) 40%, rgba(11,11,12,0.62) 100%)",
        }} />
        {/* Subtle vignette */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 120% 100% at 50% 0%, transparent 30%, rgba(11,11,12,0.45) 100%)",
        }} />
      </div>

      {/* All page content sits above the bg */}
      <div className="relative" style={{ zIndex: 1 }}>

      <AnimatePresence>
        {showIntro && (
          <IntroAnimation key="intro" onDone={handleIntroDone} />
        )}
      </AnimatePresence>

      {!showIntro && (
        <>
          <Nav page={page} setPage={setPage} lang={activeLang} setLang={setActiveLang} />

          <AnimatePresence mode="wait">
            <motion.main
              key={page}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {page === "home" && <HomePage setPage={setPage} lang={activeLang} />}
              {page === "how" && <HowPage lang={activeLang} />}
              {page === "app" && <AppPage lang={activeLang} />}
              {page === "download" && <DownloadPage lang={activeLang} />}
              {page === "new" && <NewPage lang={activeLang} />}
              {page === "bugs" && <BugsPage lang={activeLang} />}
            </motion.main>
          </AnimatePresence>

          <Footer setPage={setPage} lang={activeLang} />
        </>
      )}
      </div>{/* end z-index wrapper */}
    </div>
  );
}
