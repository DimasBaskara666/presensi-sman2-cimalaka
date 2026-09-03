import Image from "next/image";

export type SchoolLogoVariant = "color" | "white" | "bw";

type SchoolLogoProps = {
  variant?: SchoolLogoVariant;
  height?: number;
  width?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
};

const LOGO_PATHS: Record<SchoolLogoVariant, string> = {
  color: "/logo/logo-color.png",
  white: "/logo/logo-white.png",
  bw: "/logo/logo-bw.png",
};

// Aspect ratio is based on original image dimensions (895 x 1200)
const ORIGINAL_WIDTH = 895;
const ORIGINAL_HEIGHT = 1200;

export function SchoolLogo({
  variant = "color",
  height = 48,
  width,
  className,
  priority = false,
  alt = "Logo SMAN 2 Cimalaka",
}: SchoolLogoProps) {
  const computedHeight = height;
  const computedWidth = width ?? Math.round((computedHeight * ORIGINAL_WIDTH) / ORIGINAL_HEIGHT);

  return (
    <Image
      src={LOGO_PATHS[variant]}
      alt={alt}
      width={computedWidth}
      height={computedHeight}
      priority={priority}
      className={className ? `school-logo ${className}` : "school-logo"}
    />
  );
}
