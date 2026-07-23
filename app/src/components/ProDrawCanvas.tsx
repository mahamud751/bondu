import React, { useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export type DrawPoint = { x: number; y: number };
export type DrawStroke = {
  color: string;
  width: number;
  points: DrawPoint[];
};

type Props = {
  strokes: DrawStroke[];
  enabled?: boolean;
  color?: string;
  width?: number;
  onChange?: (strokes: DrawStroke[]) => void;
  height?: number;
};

/**
 * Path-based draw engine: continuous polylines as short segments
 * (professional enough for live mini-games without native Skia).
 */
export function ProDrawCanvas({
  strokes,
  enabled = true,
  color = '#FFFFFF',
  width = 4,
  onChange,
  height = 180,
}: Props) {
  const [size, setSize] = useState({ w: 1, h: height });
  const local = useRef<DrawStroke[]>(strokes ?? []);
  const current = useRef<DrawStroke | null>(null);
  const [, force] = useState(0);

  // sync external strokes when viewer
  React.useEffect(() => {
    if (!enabled) {
      local.current = strokes ?? [];
      force((n) => n + 1);
    }
  }, [strokes, enabled]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => enabled,
        onMoveShouldSetPanResponder: () => enabled,
        onPanResponderGrant: (e) => {
          if (!enabled) return;
          const { locationX, locationY } = e.nativeEvent;
          current.current = {
            color,
            width,
            points: [{ x: locationX, y: locationY }],
          };
          local.current = [...local.current, current.current].slice(-40);
          force((n) => n + 1);
        },
        onPanResponderMove: (e) => {
          if (!enabled || !current.current) return;
          const { locationX, locationY } = e.nativeEvent;
          const pts = current.current.points;
          const last = pts[pts.length - 1];
          const dx = locationX - last.x;
          const dy = locationY - last.y;
          if (dx * dx + dy * dy < 4) return; // distance filter
          current.current.points = [
            ...pts,
            { x: locationX, y: locationY },
          ].slice(-120);
          // replace last stroke
          local.current = [
            ...local.current.slice(0, -1),
            current.current,
          ];
          force((n) => n + 1);
          if (current.current.points.length % 3 === 0) {
            onChange?.(local.current);
          }
        },
        onPanResponderRelease: () => {
          if (!enabled) return;
          onChange?.(local.current);
          current.current = null;
        },
      }),
    [color, enabled, onChange, width],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    setSize({
      w: e.nativeEvent.layout.width,
      h: e.nativeEvent.layout.height,
    });
  };

  const renderStroke = (stroke: DrawStroke, si: number) => {
    const segs = [];
    for (let i = 1; i < stroke.points.length; i++) {
      const a = stroke.points[i - 1];
      const b = stroke.points[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      segs.push(
        <View
          key={`${si}-${i}`}
          style={{
            position: 'absolute',
            left: a.x,
            top: a.y - stroke.width / 2,
            width: len,
            height: stroke.width,
            borderRadius: stroke.width,
            backgroundColor: stroke.color,
            transform: [{ rotate: `${angle}deg` }],
            transformOrigin: 'left center',
          }}
        />,
      );
    }
    // dots for single points
    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      segs.push(
        <View
          key={`${si}-dot`}
          style={{
            position: 'absolute',
            left: p.x - stroke.width,
            top: p.y - stroke.width,
            width: stroke.width * 2,
            height: stroke.width * 2,
            borderRadius: stroke.width,
            backgroundColor: stroke.color,
          }}
        />,
      );
    }
    return segs;
  };

  return (
    <View
      style={[styles.canvas, { height }]}
      onLayout={onLayout}
      {...pan.panHandlers}
    >
      {/* grid */}
      <View style={styles.gridH} />
      <View style={[styles.gridH, { top: '66%' }]} />
      <View style={styles.gridV} />
      <View style={[styles.gridV, { left: '66%' }]} />

      {(enabled ? local.current : strokes).flatMap((s, i) =>
        renderStroke(s, i),
      )}

      <Text style={styles.hint}>
        {enabled
          ? `Draw · ${size.w.toFixed(0)}×${size.h.toFixed(0)} path engine`
          : 'Live drawing feed'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  gridH: {
    position: 'absolute',
    top: '33%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  gridV: {
    position: 'absolute',
    left: '33%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  hint: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    width: '100%',
    textAlign: 'center',
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontWeight: '600',
  },
});
