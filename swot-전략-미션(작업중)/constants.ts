import { LandingPageStyle, FeatureItem } from './types';

export const COLORS = {
  primary: 'indigo',
  secondary: 'purple',
  accent: 'pink',
};

export const UI_TEXT = {
  appName: 'SWOT 전략 미션',
  adminLogin: '관리자 로그인',
  joinGame: '게임 참여',
  preparing: '전략 수립 중...',
  ready: '준비 완료',
  playing: '경기 진행 중',
  finished: '경기 종료',
};

// --- Landing Page Builder Constants ---

export const LANDING_PAGE_STYLES: LandingPageStyle[] = [
  {
    id: 'dynamic-glassmorphism',
    name: 'Dynamic Glassmorphism',
    description: 'Modern, frosted glass aesthetic with vibrant background gradients.',
    imageUrl: 'https://placehold.co/600x400/1e293b/FFF?text=Glassmorphism',
  },
  {
    id: 'ios-clean',
    name: 'iOS Clean',
    description: 'Minimalist design inspired by iOS guidelines with rounded corners and clean typography.',
    imageUrl: 'https://placehold.co/600x400/1e293b/FFF?text=iOS+Clean',
  },
  {
    id: 'material-3',
    name: 'Material Design 3',
    description: 'Google\'s latest design system featuring dynamic color and playful interactions.',
    imageUrl: 'https://placehold.co/600x400/1e293b/FFF?text=Material+3',
  },
  {
    id: 'bento-mobile',
    name: 'Bento Grid Mobile',
    description: 'Structured grid layout optimized for mobile content consumption.',
    imageUrl: 'https://placehold.co/600x400/1e293b/FFF?text=Bento+Grid',
  },
  {
    id: 'dark-neon',
    name: 'Cyberpunk Neon',
    description: 'High contrast dark mode with neon accents, perfect for gaming or nightlife apps.',
    imageUrl: 'https://placehold.co/600x400/1e293b/FFF?text=Neon+Dark',
  },
  {
    id: 'neumorphism',
    name: 'Soft Neumorphism',
    description: 'Soft shadows and extruded shapes creating a tactile, realistic feel.',
    imageUrl: 'https://placehold.co/600x400/1e293b/FFF?text=Neumorphism',
  },
];

export const TARGET_DEVICES = [
  { id: 'mobile', label: 'Mobile', icon: '📱' },
  { id: 'tablet', label: 'Tablet', icon: 'iPad' },
  { id: 'desktop', label: 'Desktop', icon: '💻' },
];

export const AUTO_GEN_CATEGORIES = [
  {
    id: 'visual',
    title: 'VISUAL & THEME',
    items: [
      { id: 'theme_system', label: 'Dark/Light Mode Support' },
      { id: 'animations', label: 'Micro-interactions' },
    ]
  },
  {
    id: 'func',
    title: 'CORE FEATURES',
    items: [
      { id: 'pwa', label: 'PWA (Installable)' },
      { id: 'auth_ui', label: 'Auth Screens' },
      { id: 'offline', label: 'Offline UI' },
    ]
  },
];

export const ADDITIONAL_FEATURES: FeatureItem[] = [
  { id: 'scrollytelling', name: 'Scrollytelling', description: 'Narrative unfolds as user scrolls.', category: 'Motion' },
  { id: 'parallax-scrolling', name: 'Parallax Effects', description: 'Depth creation with background movement.', category: 'Motion' },
  { id: 'svg-morphing', name: 'SVG Morphing', description: 'Smooth shape transitions.', category: 'Motion' },
  { id: 'kinetic-typography', name: 'Kinetic Typography', description: 'Moving text for emphasis.', category: 'Motion' },
  { id: 'magnetic-buttons', name: 'Magnetic Buttons', description: 'Buttons that attract the cursor.', category: 'Interaction' },
  { id: '3d-tilt', name: '3D Tilt Cards', description: 'Cards that tilt on hover.', category: 'Interaction' },
  { id: 'custom-cursor', name: 'Custom Cursor', description: 'Unique cursor styling.', category: 'Interaction' },
  { id: 'dark-mode', name: 'Dark Mode Toggle', description: 'User switchable theme.', category: 'Utility' },
  { id: 'skeleton-loading', name: 'Skeleton Loading', description: 'Loading state placeholders.', category: 'Utility' },
];