import { useEffect, useRef, useState } from "react";

interface DynamicBackgroundProps {
  type: string;
  className?: string;
}

export function DynamicBackground({ type, className = "" }: DynamicBackgroundProps) {
  if (type === "earth-rotation") {
    return <EarthRotation className={className} />;
  }
  if (type === "animated-stars") {
    return <AnimatedStars className={className} />;
  }
  if (type === "matrix-rain") {
    return <MatrixRain className={className} />;
  }
  return null;
}

function EarthRotation({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [time, setTime] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let animationId: number;
    let rotation = 0;

    const draw = () => {
      if (!ctx) return;
      const { width, height } = canvas;

      ctx.fillStyle = "#0a0a1a";
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < 200; i++) {
        const x = (Math.sin(i * 1234.5) * 0.5 + 0.5) * width;
        const y = (Math.cos(i * 5678.9) * 0.5 + 0.5) * height;
        const brightness = Math.sin(rotation * 0.01 + i) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255, 255, 255, ${brightness * 0.8})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.random() * 1.5 + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.25;

      const gradient = ctx.createRadialGradient(
        centerX - radius * 0.3,
        centerY - radius * 0.3,
        0,
        centerX,
        centerY,
        radius
      );
      gradient.addColorStop(0, "#4a90d9");
      gradient.addColorStop(0.3, "#2d6bb5");
      gradient.addColorStop(0.6, "#1e4d8c");
      gradient.addColorStop(1, "#0a1628");

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.globalAlpha = 0.4;
      const continentCount = 5;
      for (let i = 0; i < continentCount; i++) {
        const angle = rotation * 0.005 + (i * Math.PI * 2) / continentCount;
        const visiblePart = Math.cos(angle);
        if (visiblePart > 0) {
          const x = centerX + Math.sin(angle) * radius * 0.7;
          const y = centerY + (Math.random() * 0.4 - 0.2) * radius;
          const size = radius * 0.3 * visiblePart;

          ctx.fillStyle = "#2d8c4e";
          ctx.beginPath();
          ctx.ellipse(x, y, size, size * 0.6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      ctx.globalAlpha = 0.15;
      for (let i = 0; i < 8; i++) {
        const cloudAngle = rotation * 0.003 + i * 0.8;
        const cloudX = centerX + Math.cos(cloudAngle) * radius * 0.8;
        const cloudY = centerY + Math.sin(cloudAngle * 2) * radius * 0.4;
        const cloudSize = radius * 0.15;

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(cloudX, cloudY, cloudSize, cloudSize * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.restore();

      const atmosphereGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        radius * 0.95,
        centerX,
        centerY,
        radius * 1.15
      );
      atmosphereGradient.addColorStop(0, "rgba(100, 180, 255, 0.3)");
      atmosphereGradient.addColorStop(0.5, "rgba(100, 180, 255, 0.1)");
      atmosphereGradient.addColorStop(1, "rgba(100, 180, 255, 0)");

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.15, 0, Math.PI * 2);
      ctx.fillStyle = atmosphereGradient;
      ctx.fill();

      rotation += 1;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 -z-10 ${className}`}
      style={{ pointerEvents: "none" }}
    />
  );
}

function AnimatedStars({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    interface Star {
      x: number;
      y: number;
      size: number;
      speed: number;
      brightness: number;
      twinkleSpeed: number;
    }

    const stars: Star[] = [];
    for (let i = 0; i < 300; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.5 + 0.1,
        brightness: Math.random(),
        twinkleSpeed: Math.random() * 0.02 + 0.01,
      });
    }

    let animationId: number;
    let time = 0;

    const draw = () => {
      const { width, height } = canvas;

      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#0a0a1a");
      gradient.addColorStop(0.5, "#1a1a2e");
      gradient.addColorStop(1, "#0f0f23");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      stars.forEach((star) => {
        const twinkle = Math.sin(time * star.twinkleSpeed + star.brightness * 10) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255, 255, 255, ${twinkle})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        star.y += star.speed;
        if (star.y > height) {
          star.y = 0;
          star.x = Math.random() * width;
        }
      });

      time++;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 -z-10 ${className}`}
      style={{ pointerEvents: "none" }}
    />
  );
}

function MatrixRain({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()";
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = [];

    for (let i = 0; i < columns; i++) {
      drops[i] = Math.random() * -100;
    }

    let animationId: number;

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#0f0";
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        const gradient = ctx.createLinearGradient(x, y - fontSize * 5, x, y);
        gradient.addColorStop(0, "rgba(0, 255, 0, 0)");
        gradient.addColorStop(1, "rgba(0, 255, 0, 1)");
        ctx.fillStyle = gradient;

        ctx.fillText(char, x, y);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }

      animationId = requestAnimationFrame(draw);
    };

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 -z-10 ${className}`}
      style={{ pointerEvents: "none" }}
    />
  );
}
