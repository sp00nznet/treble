/**
 * Minimal windowed list — only the rows in (and near) the viewport are mounted,
 * so a 2,000-track playlist sorts/scrolls instantly instead of reconciling
 * thousands of DOM nodes. Rows are a fixed height; a sticky `header` (e.g. the
 * column row) stays pinned.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

export function VirtualList<T>({
  items, rowHeight, renderRow, header, overscan = 8,
}: {
  items: T[];
  rowHeight: number;
  renderRow: (item: T, index: number) => ReactNode;
  header?: ReactNode;
  overscan?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(800);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setViewH(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = items.length * rowHeight;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(items.length, Math.ceil((scrollTop + viewH) / rowHeight) + overscan);

  return (
    <div
      ref={ref}
      onScroll={(e) => setScrollTop((e.currentTarget as HTMLDivElement).scrollTop)}
      style={{ flex: 1, minHeight: 0, overflowY: "auto" }}
    >
      {header && <div style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--bg)" }}>{header}</div>}
      <div style={{ height: total, position: "relative" }}>
        {items.slice(start, end).map((item, i) => (
          <div key={start + i} style={{ position: "absolute", top: (start + i) * rowHeight, left: 0, right: 0, height: rowHeight }}>
            {renderRow(item, start + i)}
          </div>
        ))}
      </div>
    </div>
  );
}
