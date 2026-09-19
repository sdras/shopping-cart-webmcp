const base = { viewBox: "0 0 24 24", "aria-hidden": true, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

export const SearchIcon = ({ size = 20 }) => (
  <svg {...base} width={size} height={size}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const CartIcon = ({ size = 22 }) => (
  <svg {...base} width={size} height={size}>
    <path d="M3 4h2.5l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.4-1.1L20.5 8H6.4" />
    <circle cx="10" cy="19.5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="17" cy="19.5" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const PinIcon = ({ size = 20 }) => (
  <svg {...base} width={size} height={size}>
    <path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);

export const BoltIcon = ({ size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="currentColor">
    <path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.8z" />
  </svg>
);

export const StockIcon = ({ size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="currentColor">
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" />
    <rect x="8" y="3" width="8" height="8" rx="1.5" />
  </svg>
);

const CHEVRONS = {
  left: "m15 5-7 7 7 7",
  right: "m9 5 7 7-7 7",
  up: "m5 15 7-7 7 7",
  down: "m5 9 7 7 7-7",
};

export const ChevronIcon = ({ direction = "right", size = 18 }) => (
  <svg {...base} width={size} height={size} strokeWidth={2.5}>
    <path d={CHEVRONS[direction]} />
  </svg>
);

export const CloseIcon = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} strokeWidth={2.5}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const HomeIcon = ({ size = 20 }) => (
  <svg {...base} width={size} height={size}>
    <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />
  </svg>
);

export const ReceiptIcon = ({ size = 20 }) => (
  <svg {...base} width={size} height={size}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />
  </svg>
);

export const TrashIcon = ({ size = 16 }) => (
  <svg {...base} width={size} height={size}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);

export const StarIcon = ({ filled = false, size = 18 }) => (
  <svg {...base} width={size} height={size} fill={filled ? "currentColor" : "none"}>
    <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />
  </svg>
);

export const BookIcon = ({ size = 20 }) => (
  <svg {...base} width={size} height={size}>
    <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M9 8h6" />
  </svg>
);
