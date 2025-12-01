/**
 * Adjusts the brightness of a hex color.
 * @param hex The hex color string (e.g., "#ff0000" or "ff0000")
 * @param percent The percentage to adjust (-100 to 100). Positive lightens, negative darkens.
 * @returns The adjusted hex color.
 */
export const adjustBrightness = (hex: string, percent: number): string => {
    let r = parseInt(hex.replace('#', '').substring(0, 2), 16);
    let g = parseInt(hex.replace('#', '').substring(2, 4), 16);
    let b = parseInt(hex.replace('#', '').substring(4, 6), 16);

    r = Math.round(r * (1 + percent / 100));
    g = Math.round(g * (1 + percent / 100));
    b = Math.round(b * (1 + percent / 100));

    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));

    const rr = (r.toString(16).length === 1 ? '0' : '') + r.toString(16);
    const gg = (g.toString(16).length === 1 ? '0' : '') + g.toString(16);
    const bb = (b.toString(16).length === 1 ? '0' : '') + b.toString(16);

    return `#${rr}${gg}${bb}`;
};

/**
 * Converts a hex color to an RGB object.
 */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

/**
 * Generates premium gradient styles from a base color.
 * Creates a gradient from (base + 20% light) to (base - 10% dark)
 * and adds a colored shadow.
 */
export const generateGradientStyle = (baseColor: string) => {
    const startColor = adjustBrightness(baseColor, 20); // Lighter
    const endColor = adjustBrightness(baseColor, -10);  // Darker
    const rgb = hexToRgb(baseColor);

    const shadowColor = rgb
        ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`
        : 'rgba(0,0,0,0.3)';

    return {
        background: `linear-gradient(to right, ${startColor}, ${endColor})`,
        boxShadow: `0 4px 6px -1px ${shadowColor}, 0 2px 4px -1px ${shadowColor}`,
        color: '#fff',
        border: 'none'
    };
};
