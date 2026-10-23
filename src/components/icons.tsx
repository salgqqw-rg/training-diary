import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

// База: линейная иконка 18px (stroke = currentColor)
function S({ children, ...p }: P) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...p}
    >
      {children}
    </svg>
  );
}

export const UserIcon = (p: P) => (
  <S {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.3-3.9 4.7-5.6 8-5.6s6.7 1.7 8 5.6" /></S>
);

export const MailIcon = (p: P) => (
  <S {...p}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3 7 9 6 9-6" /></S>
);

export const LockIcon = (p: P) => (
  <S {...p}><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></S>
);

export const EyeIcon = (p: P) => (
  <S {...p}><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></S>
);

export const EyeOffIcon = (p: P) => (
  <S {...p}><path d="m4 4 16 16" /><path d="M10.6 5.9A11 11 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17.6 17.6 0 0 1-2.9 3.5" /><path d="M6.6 6.9C3.9 8.7 2 12 2 12s3.6 6.5 10 6.5c1.4 0 2.7-.3 3.8-.8" /><path d="M9.9 9.9a3 3 0 1 0 4.3 4.3" /></S>
);

export const CalendarIcon = (p: P) => (
  <S {...p}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></S>
);

export const CheckSquareIcon = (p: P) => (
  <S {...p}><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m8 12 3 3 5-6" /></S>
);

export const BoltIcon = (p: P) => (
  <S {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8" /></S>
);

// Логотип Google (фирменные 4 цвета)
export const GoogleIcon = (p: P) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...p}>
    <path
      fill="#4285F4"
      d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.63v3.02h3.87c2.26-2.08 3.57-5.15 3.57-8.84z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.96-1.07 7.94-2.89l-3.87-3.02c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.12A12 12 0 0 0 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.6H1.29a12 12 0 0 0 0 10.8l3.98-3.12z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.76 0 3.35.61 4.6 1.8l3.43-3.43A11.75 11.75 0 0 0 12 0 12 12 0 0 0 1.29 6.6l3.98 3.12C6.22 6.86 8.87 4.75 12 4.75z"
    />
  </svg>
);
