import { useMemo } from "react"
import { encode } from "uqr"

/**
 * A QR code as one SVG path, one unit square per dark module, so it stays
 * crisp at any size. It draws no quiet zone of its own: the white box it
 * sits in is the margin a scanner needs.
 */
export function QrCode({ value, label, className }: {
  readonly value: string
  /** Read out for the code; absent when the code is decoration beside a label. */
  readonly label?: string
  readonly className?: string
}) {
  const { path, size } = useMemo(() => {
    const { data, size } = encode(value, { border: 0 })
    let path = ""
    data.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) path += `M${x} ${y}h1v1h-1z`
      })
    })
    return { path, size }
  }, [value])

  return (
    <svg
      className={className}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <path d={path} fill="#08090c" />
    </svg>
  )
}
