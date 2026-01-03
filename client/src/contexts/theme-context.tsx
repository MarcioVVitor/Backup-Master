import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { THEMES, applyTheme, getStoredTheme, saveTheme, type ThemeDefinition } from "@/lib/themes";
import { BACKGROUND_OPTIONS, type BackgroundOption } from "@/lib/os-themes";

interface ThemeContextType {
  themeId: string;
  isDark: boolean;
  theme: ThemeDefinition | undefined;
  backgroundId: string;
  background: BackgroundOption | undefined;
  logoUrl: string;
  systemName: string;
  setTheme: (themeId: string) => void;
  toggleDark: () => void;
  setDark: (isDark: boolean) => void;
  setBackground: (backgroundId: string) => void;
  setLogoUrl: (url: string) => void;
  setSystemName: (name: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY_BACKGROUND = "nbm-background-id";
const STORAGE_KEY_LOGO = "nbm-logo-url";
const STORAGE_KEY_SYSTEM_NAME = "nbm-system-name";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<string>("macos-sequoia");
  const [isDark, setIsDark] = useState<boolean>(false);
  const [backgroundId, setBackgroundId] = useState<string>("none");
  const [logoUrl, setLogoUrlState] = useState<string>("");
  const [systemName, setSystemNameState] = useState<string>("NBM");

  useEffect(() => {
    const stored = getStoredTheme();
    setThemeId(stored.themeId);
    setIsDark(stored.isDark);
    applyTheme(stored.themeId, stored.isDark);

    const storedBackground = localStorage.getItem(STORAGE_KEY_BACKGROUND);
    if (storedBackground) {
      setBackgroundId(storedBackground);
    }

    const storedLogo = localStorage.getItem(STORAGE_KEY_LOGO);
    if (storedLogo) {
      setLogoUrlState(storedLogo);
    }

    const storedSystemName = localStorage.getItem(STORAGE_KEY_SYSTEM_NAME);
    if (storedSystemName) {
      setSystemNameState(storedSystemName);
    }
  }, []);

  const setTheme = (newThemeId: string) => {
    setThemeId(newThemeId);
    saveTheme(newThemeId, isDark);
    applyTheme(newThemeId, isDark);
  };

  const toggleDark = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    saveTheme(themeId, newDark);
    applyTheme(themeId, newDark);
  };

  const setDarkMode = (newDark: boolean) => {
    setIsDark(newDark);
    saveTheme(themeId, newDark);
    applyTheme(themeId, newDark);
  };

  const setBackground = (newBackgroundId: string) => {
    setBackgroundId(newBackgroundId);
    localStorage.setItem(STORAGE_KEY_BACKGROUND, newBackgroundId);
  };

  const setLogoUrl = (url: string) => {
    setLogoUrlState(url);
    localStorage.setItem(STORAGE_KEY_LOGO, url);
  };

  const setSystemName = (name: string) => {
    setSystemNameState(name);
    localStorage.setItem(STORAGE_KEY_SYSTEM_NAME, name);
  };

  const theme = THEMES.find(t => t.id === themeId);
  const background = BACKGROUND_OPTIONS.find(b => b.id === backgroundId);

  return (
    <ThemeContext.Provider value={{ 
      themeId, 
      isDark, 
      theme, 
      backgroundId,
      background,
      logoUrl,
      systemName,
      setTheme, 
      toggleDark, 
      setDark: setDarkMode,
      setBackground,
      setLogoUrl,
      setSystemName
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
