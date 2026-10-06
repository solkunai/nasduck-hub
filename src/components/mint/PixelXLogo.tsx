// Pixel-art X (Twitter) logo for the "Flex on X" buttons.
export function PixelXLogo({ size = 24, className = '' }: { size?: number; className?: string }) {
  return <img src="/mint/x_logo_pixel.png" alt="" aria-hidden width={size} height={size} className={className} />
}
