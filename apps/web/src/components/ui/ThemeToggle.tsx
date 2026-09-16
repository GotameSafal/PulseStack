"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render a skeleton placeholder icon to prevent hydration flicker
    return (
      <Button
        variant="ghost"
        size="sm"
        isIconOnly
        className="w-9 h-9 rounded-xl hover:bg-secondary/40 text-muted-foreground"
        aria-label="Toggle theme"
      >
        <div className="w-[1.2rem] h-[1.2rem] rounded-full bg-muted/30 animate-pulse" />
      </Button>
    );
  }

  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const getIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className="w-[1.2rem] h-[1.2rem] text-amber-500 animate-in fade-in zoom-in duration-300" />;
      case "dark":
        return <Moon className="w-[1.2rem] h-[1.2rem] text-blue-400 animate-in fade-in zoom-in duration-300" />;
      default:
        return <Monitor className="w-[1.2rem] h-[1.2rem] text-primary animate-in fade-in zoom-in duration-300" />;
    }
  };

  const getLabel = () => {
    switch (theme) {
      case "light":
        return "Theme: Light (Click to switch to Dark)";
      case "dark":
        return "Theme: Dark (Click to switch to System)";
      default:
        return "Theme: System (Click to switch to Light)";
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      isIconOnly
      onClick={cycleTheme}
      className="w-9 h-9 rounded-xl hover:bg-secondary/40 flex items-center justify-center transition-all"
      aria-label={getLabel()}
    >
      {getIcon()}
    </Button>
  );
}
