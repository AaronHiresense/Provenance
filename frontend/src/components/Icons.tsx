import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { className?: string };

function Icon({ children, className = "w-4 h-4", ...rest }: P) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const ShieldIcon = (p: P) => (
  <Icon {...p}>
    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </Icon>
);
export const AlertIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </Icon>
);
export const InfoIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8v.5" />
  </Icon>
);
export const CheckIcon = (p: P) => (
  <Icon {...p}>
    <path d="M5 12l5 5L20 7" />
  </Icon>
);
export const XIcon = (p: P) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
export const ChevronIcon = ({ open, ...p }: P & { open?: boolean }) => (
  <Icon {...p} className={`${p.className ?? "w-4 h-4"} transition-transform ${open ? "rotate-90" : ""}`}>
    <path d="M9 6l6 6-6 6" />
  </Icon>
);
export const SearchIcon = (p: P) => (
  <Icon {...p}>
    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </Icon>
);
export const FileIcon = (p: P) => (
  <Icon {...p}>
    <path d="M7 3h7l5 5v13H7z" />
    <path d="M14 3v5h5M10 13h6M10 17h6" />
  </Icon>
);
export const UploadIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
  </Icon>
);
export const CpuIcon = (p: P) => (
  <Icon {...p}>
    <path d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
  </Icon>
);
export const PlayIcon = ({ className = "w-4 h-4" }: P) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 5v14l11-7z" />
  </svg>
);
export const SpinnerIcon = (p: P) => (
  <Icon {...p} className={`${p.className ?? "w-4 h-4"} animate-spin`}>
    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </Icon>
);
export const MoonIcon = (p: P) => (
  <Icon {...p}>
    <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </Icon>
);
export const SunIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </Icon>
);

export const BracesIcon = (p: P) => (
  <Icon {...p}>
    <path d="M8 3H7a2 2 0 00-2 2v4a2 2 0 01-2 2 2 2 0 012 2v4a2 2 0 002 2h1M16 3h1a2 2 0 012 2v4a2 2 0 002 2 2 2 0 00-2 2v4a2 2 0 01-2 2h-1" />
  </Icon>
);
export const RefreshIcon = (p: P) => (
  <Icon {...p}>
    <path d="M21 12a9 9 0 11-2.64-6.36M21 3v6h-6" />
  </Icon>
);
export const ArrowRightIcon = (p: P) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);
export const ClockIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);
export const BuildingIcon = (p: P) => (
  <Icon {...p}>
    <path d="M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16M4 21h16M16 9h2a2 2 0 012 2v10M8 7h4M8 11h4M8 15h4" />
  </Icon>
);
export const TruckIcon = (p: P) => (
  <Icon {...p}>
    <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </Icon>
);
export const BoxIcon = (p: P) => (
  <Icon {...p}>
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
    <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
  </Icon>
);
export const FingerprintIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 11c0-1.66-1.34-3-3-3s-3 1.34-3 3c0 3.5 2 6 3 7" />
    <path d="M12 2a10 10 0 00-9.9 8.6c.1 1.1.4 2.2.9 3.2" />
    <path d="M14 6.5A7.5 7.5 0 0118.5 12c0 2-.5 3.5-1.5 5" />
    <path d="M17 19.5a10.9 10.9 0 01-5 1.5 11 11 0 01-6.5-2.2" />
    <path d="M8 14.5c.5 1.5 1.5 2.5 3 2.5" />
  </Icon>
);
export const BadgeCheckIcon = (p: P) => (
  <Icon {...p}>
    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);
export const ShieldAlertIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M12 8v4M12 16h.01" />
  </Icon>
);
export const UserIcon = (p: P) => (
  <Icon {...p}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </Icon>
);
export const LinkIcon = (p: P) => (
  <Icon {...p}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </Icon>
);
export const CopyIcon = (p: P) => (
  <Icon {...p}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </Icon>
);
export const TargetIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </Icon>
);
export const BarChartIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 20V10M18 20V4M6 20v-4" />
  </Icon>
);
export const FactoryIcon = (p: P) => (
  <Icon {...p}>
    <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4H2z" />
    <path d="M17 18h1M12 18h1M7 18h1" />
  </Icon>
);
export const CheckCircleIcon = (p: P) => (
  <Icon {...p}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <path d="m9 11 3 3L22 4" />
  </Icon>
);
export const BotIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
  </Icon>
);


