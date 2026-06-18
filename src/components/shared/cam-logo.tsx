import Image from "next/image";

export function CamLogo({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-border ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/logo-cam.png"
        alt="Centro de Apoyo Mutuo"
        width={size}
        height={size}
        className="object-contain"
        priority
      />
    </span>
  );
}
