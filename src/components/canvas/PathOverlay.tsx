import { useStore } from "../../store";

export function PathOverlay() {
  const { paths, imageWidth, imageHeight } = useStore();

  if (paths.length === 0 || imageWidth === 0) return null;

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      width={imageWidth}
      height={imageHeight}
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
    >
      {paths.map((path, i) => {
        const color = path.color;
        const size = path.size;
        const opacity = path.opacity;

        // Dot tool: render a filled circle
        if (path.tool === "dot" || path.points.length === 1) {
          const [cx, cy] = path.points[0];
          return (
            <g key={i} opacity={opacity}>
              <circle cx={cx} cy={cy} r={size / 2} fill={color} />
              {/* Click point */}
              <circle
                cx={path.clickPoint[0]}
                cy={path.clickPoint[1]}
                r={5}
                fill="#FFFF00"
                stroke="#000000"
                strokeWidth={1.5}
              />
            </g>
          );
        }

        if (path.points.length < 2) return null;

        const d = path.points
          .map((p, j) => `${j === 0 ? "M" : "L"} ${p[0]} ${p[1]}`)
          .join(" ");

        // Brighter outer color
        const outerColor = adjustBrightness(color, 40);

        return (
          <g key={i} opacity={opacity}>
            {/* Outer highlight line */}
            <path
              d={d}
              fill="none"
              stroke={outerColor}
              strokeWidth={size + 3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Inner main color line */}
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={size}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Click point */}
            <circle
              cx={path.clickPoint[0]}
              cy={path.clickPoint[1]}
              r={5}
              fill="#FFFF00"
              stroke="#000000"
              strokeWidth={1.5}
            />
          </g>
        );
      })}
    </svg>
  );
}

function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  if (isNaN(num)) return hex;
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
