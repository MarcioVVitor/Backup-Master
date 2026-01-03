export interface OSTheme {
  id: string;
  name: string;
  description: string;
  preview: string;
  colors: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    border: string;
    sidebar: string;
    sidebarForeground: string;
    sidebarAccent: string;
  };
  darkColors?: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    border: string;
    sidebar: string;
    sidebarForeground: string;
    sidebarAccent: string;
  };
}

export interface BackgroundOption {
  id: string;
  name: string;
  type: "static" | "gradient" | "dynamic";
  value: string;
  preview?: string;
}

export const OS_THEMES: OSTheme[] = [
  {
    id: "default",
    name: "NBM Padrão",
    description: "Tema padrão do sistema",
    preview: "linear-gradient(135deg, #1e293b, #334155)",
    colors: {
      background: "0 0% 100%",
      foreground: "222 84% 5%",
      card: "0 0% 100%",
      cardForeground: "222 84% 5%",
      primary: "221 83% 53%",
      primaryForeground: "210 40% 98%",
      secondary: "210 40% 96%",
      secondaryForeground: "222 47% 11%",
      muted: "210 40% 96%",
      mutedForeground: "215 16% 47%",
      accent: "210 40% 96%",
      accentForeground: "222 47% 11%",
      border: "214 32% 91%",
      sidebar: "222 47% 11%",
      sidebarForeground: "210 40% 98%",
      sidebarAccent: "217 33% 17%",
    },
    darkColors: {
      background: "222 84% 5%",
      foreground: "210 40% 98%",
      card: "222 84% 5%",
      cardForeground: "210 40% 98%",
      primary: "217 91% 60%",
      primaryForeground: "222 47% 11%",
      secondary: "217 33% 17%",
      secondaryForeground: "210 40% 98%",
      muted: "217 33% 17%",
      mutedForeground: "215 20% 65%",
      accent: "217 33% 17%",
      accentForeground: "210 40% 98%",
      border: "217 33% 17%",
      sidebar: "222 84% 5%",
      sidebarForeground: "210 40% 98%",
      sidebarAccent: "217 33% 17%",
    },
  },
  {
    id: "windows-xp",
    name: "Windows XP",
    description: "Tema clássico Luna do Windows XP",
    preview: "linear-gradient(180deg, #0a246a, #3a6ea5)",
    colors: {
      background: "210 29% 97%",
      foreground: "0 0% 0%",
      card: "0 0% 100%",
      cardForeground: "0 0% 0%",
      primary: "213 72% 35%",
      primaryForeground: "0 0% 100%",
      secondary: "35 100% 50%",
      secondaryForeground: "0 0% 0%",
      muted: "210 20% 94%",
      mutedForeground: "0 0% 35%",
      accent: "120 60% 40%",
      accentForeground: "0 0% 100%",
      border: "210 20% 80%",
      sidebar: "213 72% 35%",
      sidebarForeground: "0 0% 100%",
      sidebarAccent: "213 72% 45%",
    },
    darkColors: {
      background: "213 50% 15%",
      foreground: "0 0% 100%",
      card: "213 50% 20%",
      cardForeground: "0 0% 100%",
      primary: "213 72% 50%",
      primaryForeground: "0 0% 100%",
      secondary: "35 100% 50%",
      secondaryForeground: "0 0% 0%",
      muted: "213 40% 25%",
      mutedForeground: "0 0% 70%",
      accent: "120 60% 50%",
      accentForeground: "0 0% 100%",
      border: "213 40% 30%",
      sidebar: "213 72% 20%",
      sidebarForeground: "0 0% 100%",
      sidebarAccent: "213 72% 30%",
    },
  },
  {
    id: "windows-11",
    name: "Windows 11",
    description: "Tema moderno Fluent do Windows 11",
    preview: "linear-gradient(135deg, #0078d4, #00bcf2)",
    colors: {
      background: "0 0% 98%",
      foreground: "0 0% 9%",
      card: "0 0% 100%",
      cardForeground: "0 0% 9%",
      primary: "206 100% 42%",
      primaryForeground: "0 0% 100%",
      secondary: "200 15% 94%",
      secondaryForeground: "0 0% 20%",
      muted: "200 15% 96%",
      mutedForeground: "0 0% 45%",
      accent: "206 100% 50%",
      accentForeground: "0 0% 100%",
      border: "200 15% 90%",
      sidebar: "200 15% 96%",
      sidebarForeground: "0 0% 20%",
      sidebarAccent: "206 100% 95%",
    },
    darkColors: {
      background: "0 0% 7%",
      foreground: "0 0% 95%",
      card: "0 0% 10%",
      cardForeground: "0 0% 95%",
      primary: "206 100% 50%",
      primaryForeground: "0 0% 100%",
      secondary: "0 0% 15%",
      secondaryForeground: "0 0% 90%",
      muted: "0 0% 15%",
      mutedForeground: "0 0% 60%",
      accent: "206 100% 50%",
      accentForeground: "0 0% 100%",
      border: "0 0% 20%",
      sidebar: "0 0% 10%",
      sidebarForeground: "0 0% 90%",
      sidebarAccent: "206 100% 20%",
    },
  },
  {
    id: "linux-suse",
    name: "Linux openSUSE",
    description: "Tema verde característico do openSUSE",
    preview: "linear-gradient(135deg, #73ba25, #35b9ab)",
    colors: {
      background: "80 20% 97%",
      foreground: "80 20% 10%",
      card: "0 0% 100%",
      cardForeground: "80 20% 10%",
      primary: "82 65% 44%",
      primaryForeground: "0 0% 100%",
      secondary: "170 50% 47%",
      secondaryForeground: "0 0% 100%",
      muted: "80 15% 94%",
      mutedForeground: "80 10% 40%",
      accent: "170 50% 47%",
      accentForeground: "0 0% 100%",
      border: "80 15% 85%",
      sidebar: "82 65% 44%",
      sidebarForeground: "0 0% 100%",
      sidebarAccent: "82 65% 35%",
    },
    darkColors: {
      background: "80 20% 8%",
      foreground: "80 10% 95%",
      card: "80 20% 12%",
      cardForeground: "80 10% 95%",
      primary: "82 65% 50%",
      primaryForeground: "0 0% 0%",
      secondary: "170 50% 47%",
      secondaryForeground: "0 0% 100%",
      muted: "80 15% 18%",
      mutedForeground: "80 10% 60%",
      accent: "170 50% 47%",
      accentForeground: "0 0% 100%",
      border: "80 15% 25%",
      sidebar: "82 40% 15%",
      sidebarForeground: "80 10% 95%",
      sidebarAccent: "82 65% 25%",
    },
  },
  {
    id: "linux-redhat",
    name: "Linux Red Hat",
    description: "Tema vermelho corporativo do Red Hat",
    preview: "linear-gradient(135deg, #cc0000, #8b0000)",
    colors: {
      background: "0 10% 97%",
      foreground: "0 0% 10%",
      card: "0 0% 100%",
      cardForeground: "0 0% 10%",
      primary: "0 100% 40%",
      primaryForeground: "0 0% 100%",
      secondary: "0 30% 90%",
      secondaryForeground: "0 100% 30%",
      muted: "0 10% 94%",
      mutedForeground: "0 5% 40%",
      accent: "0 100% 35%",
      accentForeground: "0 0% 100%",
      border: "0 10% 85%",
      sidebar: "0 100% 25%",
      sidebarForeground: "0 0% 100%",
      sidebarAccent: "0 100% 35%",
    },
    darkColors: {
      background: "0 20% 8%",
      foreground: "0 5% 95%",
      card: "0 20% 12%",
      cardForeground: "0 5% 95%",
      primary: "0 100% 50%",
      primaryForeground: "0 0% 100%",
      secondary: "0 30% 20%",
      secondaryForeground: "0 5% 90%",
      muted: "0 15% 18%",
      mutedForeground: "0 5% 60%",
      accent: "0 100% 45%",
      accentForeground: "0 0% 100%",
      border: "0 15% 25%",
      sidebar: "0 50% 12%",
      sidebarForeground: "0 5% 95%",
      sidebarAccent: "0 100% 30%",
    },
  },
  {
    id: "macos-sonoma",
    name: "macOS Sonoma",
    description: "Tema elegante do macOS com cores suaves",
    preview: "linear-gradient(135deg, #7c3aed, #2563eb)",
    colors: {
      background: "0 0% 98%",
      foreground: "0 0% 10%",
      card: "0 0% 100%",
      cardForeground: "0 0% 10%",
      primary: "258 90% 66%",
      primaryForeground: "0 0% 100%",
      secondary: "220 15% 95%",
      secondaryForeground: "0 0% 20%",
      muted: "220 15% 96%",
      mutedForeground: "0 0% 45%",
      accent: "217 91% 60%",
      accentForeground: "0 0% 100%",
      border: "220 15% 90%",
      sidebar: "220 15% 96%",
      sidebarForeground: "0 0% 20%",
      sidebarAccent: "258 50% 95%",
    },
    darkColors: {
      background: "0 0% 8%",
      foreground: "0 0% 95%",
      card: "0 0% 12%",
      cardForeground: "0 0% 95%",
      primary: "258 90% 70%",
      primaryForeground: "0 0% 100%",
      secondary: "0 0% 18%",
      secondaryForeground: "0 0% 90%",
      muted: "0 0% 18%",
      mutedForeground: "0 0% 60%",
      accent: "217 91% 65%",
      accentForeground: "0 0% 100%",
      border: "0 0% 20%",
      sidebar: "0 0% 10%",
      sidebarForeground: "0 0% 90%",
      sidebarAccent: "258 50% 25%",
    },
  },
  {
    id: "ubuntu",
    name: "Ubuntu",
    description: "Tema laranja vibrante do Ubuntu",
    preview: "linear-gradient(135deg, #e95420, #772953)",
    colors: {
      background: "30 10% 97%",
      foreground: "0 0% 10%",
      card: "0 0% 100%",
      cardForeground: "0 0% 10%",
      primary: "17 90% 52%",
      primaryForeground: "0 0% 100%",
      secondary: "316 50% 35%",
      secondaryForeground: "0 0% 100%",
      muted: "30 10% 94%",
      mutedForeground: "0 0% 40%",
      accent: "316 50% 35%",
      accentForeground: "0 0% 100%",
      border: "30 10% 85%",
      sidebar: "316 50% 25%",
      sidebarForeground: "0 0% 100%",
      sidebarAccent: "17 90% 45%",
    },
    darkColors: {
      background: "300 10% 8%",
      foreground: "30 5% 95%",
      card: "300 10% 12%",
      cardForeground: "30 5% 95%",
      primary: "17 90% 55%",
      primaryForeground: "0 0% 100%",
      secondary: "316 50% 40%",
      secondaryForeground: "0 0% 100%",
      muted: "300 10% 18%",
      mutedForeground: "30 5% 60%",
      accent: "316 50% 40%",
      accentForeground: "0 0% 100%",
      border: "300 10% 25%",
      sidebar: "316 40% 15%",
      sidebarForeground: "30 5% 95%",
      sidebarAccent: "17 90% 35%",
    },
  },
  {
    id: "arch-linux",
    name: "Arch Linux",
    description: "Tema minimalista azul do Arch Linux",
    preview: "linear-gradient(135deg, #1793d1, #333333)",
    colors: {
      background: "0 0% 98%",
      foreground: "0 0% 15%",
      card: "0 0% 100%",
      cardForeground: "0 0% 15%",
      primary: "199 80% 46%",
      primaryForeground: "0 0% 100%",
      secondary: "0 0% 90%",
      secondaryForeground: "0 0% 20%",
      muted: "0 0% 95%",
      mutedForeground: "0 0% 40%",
      accent: "199 80% 46%",
      accentForeground: "0 0% 100%",
      border: "0 0% 88%",
      sidebar: "0 0% 20%",
      sidebarForeground: "0 0% 95%",
      sidebarAccent: "199 80% 30%",
    },
    darkColors: {
      background: "0 0% 7%",
      foreground: "0 0% 95%",
      card: "0 0% 10%",
      cardForeground: "0 0% 95%",
      primary: "199 80% 50%",
      primaryForeground: "0 0% 100%",
      secondary: "0 0% 18%",
      secondaryForeground: "0 0% 85%",
      muted: "0 0% 15%",
      mutedForeground: "0 0% 55%",
      accent: "199 80% 50%",
      accentForeground: "0 0% 100%",
      border: "0 0% 22%",
      sidebar: "0 0% 10%",
      sidebarForeground: "0 0% 90%",
      sidebarAccent: "199 80% 25%",
    },
  },
];

export const BACKGROUND_OPTIONS: BackgroundOption[] = [
  {
    id: "none",
    name: "Sem plano de fundo",
    type: "static",
    value: "transparent",
  },
  {
    id: "gradient-blue",
    name: "Gradiente Azul",
    type: "gradient",
    value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  },
  {
    id: "gradient-sunset",
    name: "Gradiente Por do Sol",
    type: "gradient",
    value: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  },
  {
    id: "gradient-ocean",
    name: "Gradiente Oceano",
    type: "gradient",
    value: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  },
  {
    id: "gradient-forest",
    name: "Gradiente Floresta",
    type: "gradient",
    value: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
  },
  {
    id: "gradient-night",
    name: "Gradiente Noturno",
    type: "gradient",
    value: "linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 50%, #16213e 100%)",
  },
  {
    id: "gradient-aurora",
    name: "Aurora Boreal",
    type: "gradient",
    value: "linear-gradient(135deg, #00c9ff 0%, #92fe9d 50%, #00c9ff 100%)",
  },
  {
    id: "dynamic-earth",
    name: "Rotacao da Terra",
    type: "dynamic",
    value: "earth-rotation",
  },
  {
    id: "dynamic-stars",
    name: "Estrelas Animadas",
    type: "dynamic",
    value: "animated-stars",
  },
  {
    id: "dynamic-matrix",
    name: "Matrix",
    type: "dynamic",
    value: "matrix-rain",
  },
];

export function getThemeById(id: string): OSTheme | undefined {
  return OS_THEMES.find(t => t.id === id);
}

export function getBackgroundById(id: string): BackgroundOption | undefined {
  return BACKGROUND_OPTIONS.find(b => b.id === id);
}
