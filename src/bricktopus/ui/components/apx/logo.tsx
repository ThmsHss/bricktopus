import { Link } from "@tanstack/react-router";

interface LogoProps {
  to?: string;
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
};

const textSizeMap = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
};

export function Logo({
  to = "/",
  className = "",
  showText = true,
  size = "md",
}: LogoProps) {
  const content = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/bricktopus.png"
        alt="Bricktopus"
        className={`${sizeMap[size]} object-contain drop-shadow-sm`}
      />
      {showText && (
        <span
          className={`font-serif tracking-tight leading-none ${textSizeMap[size]}`}
        >
          Bricktopus
        </span>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="hover:opacity-80 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}

export default Logo;
