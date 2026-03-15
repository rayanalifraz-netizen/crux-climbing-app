import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { getCheckIns, getSessions } from '../../storage';
import { useTheme } from '../../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DIAGRAM_WIDTH = SCREEN_WIDTH - 32;
const DIAGRAM_HEIGHT = DIAGRAM_WIDTH * 1.6;

// Body part definitions with positions as % of diagram dimensions
const BODY_PARTS = [
  { id: 'fingers', label: 'Fingers', x: 0.72, y: 0.42, radius: 0.055 },
  { id: 'thumb',   label: 'Thumb',   x: 0.28, y: 0.42, radius: 0.045 },
  { id: 'shoulder',label: 'Shoulder',x: 0.72, y: 0.24, radius: 0.06  },
  { id: 'elbow',   label: 'Elbow',   x: 0.76, y: 0.34, radius: 0.05  },
  { id: 'wrist',   label: 'Wrist',   x: 0.78, y: 0.44, radius: 0.045 },
  { id: 'hip',     label: 'Hip',     x: 0.62, y: 0.55, radius: 0.055 },
  { id: 'knee',    label: 'Knee',    x: 0.62, y: 0.72, radius: 0.055 },
  { id: 'ankle',   label: 'Ankle',   x: 0.62, y: 0.88, radius: 0.045 },
];

// Thresholds: [yellow, red]
const THRESHOLDS = {
  fingers:  [3, 6],
  thumb:    [3, 6],
  shoulder: [4, 8],
  elbow:    [2, 4],
  wrist:    [3, 6],
  hip:      [3, 6],
  knee:     [3, 6],
  ankle:    [3, 6],
};

function getColor(C, load, thresholds) {
  if (load === 0) return C.green;
  if (load < thresholds[0]) return C.green;
  if (load < thresholds[1]) return C.amber;
  return C.red;
}

function getBgColor(C, load, thresholds) {
  if (load === 0) return C.greenBg;
  if (load < thresholds[0]) return C.greenBg;
  if (load < thresholds[1]) return C.amberBg;
  return C.redBg;
}

function getBorderColor(C, load, thresholds) {
  if (load === 0) return C.greenBorder;
  if (load < thresholds[0]) return C.greenBorder;
  if (load < thresholds[1]) return C.amberBorder;
  return C.redBorder;
}

function getLabel(load, thresholds) {
  if (load === 0) return 'No strain';
  if (load < thresholds[0]) return 'Light';
  if (load < thresholds[1]) return 'Moderate';
  return 'High load';
}

function WindowBox({ label, labelColor, borderColor, bgColor, children, style }) {
  const { C } = useTheme();
  return (
    <View style={[{
      borderWidth: 1.5,
      borderColor: borderColor || C.border,
      backgroundColor: bgColor || C.surface,
      borderRadius: 4,
      marginBottom: 12,
    }, style]}>
      {label && (
        <View style={{
          position: 'absolute',
          top: -10,
          left: 12,
          backgroundColor: bgColor || C.surface,
          paddingHorizontal: 6,
        }}>
          <Text style={{
            fontSize: 9,
            fontWeight: '800',
            color: labelColor || C.sand,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}>{label}</Text>
        </View>
      )}
      {children}
    </View>
  );
}

function BodyDiagram({ loads }) {
  const { C } = useTheme();
  const W = DIAGRAM_WIDTH;
  const H = DIAGRAM_HEIGHT;
  const cx = W / 2;

  // Body proportions
  const headR = W * 0.1;
  const headCY = H * 0.09;
  const neckW = W * 0.06;
  const neckH = H * 0.04;
  const shoulderY = H * 0.18;
  const torsoW = W * 0.22;
  const torsoH = H * 0.28;
  const hipY = shoulderY + torsoH;
  const hipW = W * 0.2;
  const upperArmL = H * 0.14;
  const lowerArmL = H * 0.12;
  const armW = W * 0.055;
  const thighL = H * 0.2;
  const shinL = H * 0.18;
  const legW = W * 0.075;

  return (
    <Svg width={W} height={H}>
      {/* ── Silhouette ── */}
      {/* Head */}
      <Circle cx={cx} cy={headCY} r={headR} fill={C.surfaceAlt} stroke={C.borderLight} strokeWidth={1.5} />

      {/* Neck */}
      <Rect
        x={cx - neckW / 2} y={headCY + headR - 2}
        width={neckW} height={neckH + 4}
        fill={C.surfaceAlt} stroke="none"
      />

      {/* Torso */}
      <Path
        d={`
          M ${cx - torsoW} ${shoulderY}
          Q ${cx - torsoW * 1.1} ${shoulderY + torsoH * 0.5} ${cx - hipW} ${hipY}
          L ${cx + hipW} ${hipY}
          Q ${cx + torsoW * 1.1} ${shoulderY + torsoH * 0.5} ${cx + torsoW} ${shoulderY}
          Z
        `}
        fill={C.surfaceAlt} stroke={C.borderLight} strokeWidth={1.5}
      />

      {/* Left arm (user's right) */}
      <Path
        d={`
          M ${cx + torsoW - 4} ${shoulderY + 4}
          L ${cx + torsoW + armW * 0.5} ${shoulderY + upperArmL}
          L ${cx + torsoW - armW * 0.3} ${shoulderY + upperArmL + lowerArmL}
        `}
        stroke={C.borderLight} strokeWidth={armW * 1.8} strokeLinecap="round" fill="none"
      />

      {/* Right arm (user's left) */}
      <Path
        d={`
          M ${cx - torsoW + 4} ${shoulderY + 4}
          L ${cx - torsoW - armW * 0.5} ${shoulderY + upperArmL}
          L ${cx - torsoW + armW * 0.3} ${shoulderY + upperArmL + lowerArmL}
        `}
        stroke={C.borderLight} strokeWidth={armW * 1.8} strokeLinecap="round" fill="none"
      />

      {/* Left leg */}
      <Path
        d={`
          M ${cx + hipW * 0.4} ${hipY}
          L ${cx + hipW * 0.5} ${hipY + thighL}
          L ${cx + hipW * 0.3} ${hipY + thighL + shinL}
        `}
        stroke={C.borderLight} strokeWidth={legW * 1.6} strokeLinecap="round" fill="none"
      />

      {/* Right leg */}
      <Path
        d={`
          M ${cx - hipW * 0.4} ${hipY}
          L ${cx - hipW * 0.5} ${hipY + thighL}
          L ${cx - hipW * 0.3} ${hipY + thighL + shinL}
        `}
        stroke={C.borderLight} strokeWidth={legW * 1.6} strokeLinecap="round" fill="none"
      />

      {/* ── Hotspots ── */}
      {BODY_PARTS.map((part) => {
        const load = loads[part.id] || 0;
        const thresholds = THRESHOLDS[part.id];
        const color = getColor(C, load, thresholds);
        const px = part.x * W;
        const py = part.y * H;
        const r = part.radius * W;

        return (
          <Circle
            key={part.id}
            cx={px}
            cy={py}
            r={r}
            fill={color + '55'}
            stroke={color}
            strokeWidth={2}
          />
        );
      })}

      {/* ── Load numbers on hotspots ── */}
      {BODY_PARTS.map((part) => {
        const load = loads[part.id] || 0;
        const thresholds = THRESHOLDS[part.id];
        const color = getColor(C, load, thresholds);
        const px = part.x * W;
        const py = part.y * H;

        return (
          <Circle
            key={part.id + '_num'}
            cx={px}
            cy={py}
            r={0}
          />
        );
      })}
    </Svg>
  );
}

export default function HeatmapScreen() {
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [loads, setLoads] = useState({});
  const [window, setWindow] = useState(14);
  const [lastUpdated, setLastUpdated] = useState('');

  useFocusEffect(useCallback(() => { computeLoads(); }, [window]));

  const computeLoads = async () => {
    const [sessions, checkIns] = await Promise.all([getSessions(), getCheckIns()]);
    const today = new Date();
    const counts = {};

    // From sessions — hold types and movement types
    Object.entries(sessions).forEach(([dateStr, sess]) => {
      const d = new Date(dateStr);
      const diffDays = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0 || diffDays >= window) return;

      sess.holdTypes?.forEach(h => {
        if (h === 'crimps' || h === 'pockets') counts.fingers = (counts.fingers || 0) + 1;
        if (h === 'pinches') counts.thumb = (counts.thumb || 0) + 1;
        if (h === 'slopers') counts.shoulder = (counts.shoulder || 0) + 1;
      });
      sess.movementTypes?.forEach(m => {
        if (m === 'dynos') counts.shoulder = (counts.shoulder || 0) + 1;
        if (m === 'heelhooks') counts.knee = (counts.knee || 0) + 1;
        if (m === 'toehooks') counts.ankle = (counts.ankle || 0) + 1;
        if (m === 'compression') counts.hip = (counts.hip || 0) + 1;
        if (m === 'mantles') counts.wrist = (counts.wrist || 0) + 1;
      });
    });

    // From check-ins — pain areas and finger condition
    Object.entries(checkIns).forEach(([dateStr, ci]) => {
      const d = new Date(dateStr);
      const diffDays = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0 || diffDays >= window) return;

      ci.painAreas?.forEach(area => {
        if (area === 'shoulder') counts.shoulder = (counts.shoulder || 0) + 1;
        if (area === 'elbow') counts.elbow = (counts.elbow || 0) + 1;
        if (area === 'wrist') counts.wrist = (counts.wrist || 0) + 1;
        if (area === 'knee') counts.knee = (counts.knee || 0) + 1;
        if (area === 'hip') counts.hip = (counts.hip || 0) + 1;
      });

      ci.affectedFingers?.forEach(() => {
        counts.fingers = (counts.fingers || 0) + 1;
      });
    });

    setLoads(counts);
    setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
  };

  const totalLoad = Object.values(loads).reduce((a, b) => a + b, 0);
  const highParts = BODY_PARTS.filter(p => {
    const load = loads[p.id] || 0;
    return load >= THRESHOLDS[p.id][1];
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Live Strain Map</Text>
          <Text style={styles.title}>Body Load</Text>
        </View>

        {/* Window selector */}
        <View style={styles.windowRow}>
          <Text style={styles.windowLabel}>Window</Text>
          <View style={styles.windowBtns}>
            {[7, 14, 30].map(w => (
              <TouchableOpacity
                key={w}
                style={[styles.windowBtn, window === w && styles.windowBtnActive]}
                onPress={() => setWindow(w)}
              >
                <Text style={[styles.windowBtnText, window === w && styles.windowBtnTextActive]}>
                  {w}d
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.updatedText}>Updated {lastUpdated}</Text>
        </View>

        {/* Alert if high load parts */}
        {highParts.length > 0 && (
          <WindowBox
            label="⚠ High Load Detected"
            borderColor={C.redBorder}
            bgColor={C.redBg}
            labelColor={C.red}
            style={{ marginHorizontal: 16 }}
          >
            <View style={styles.alertInner}>
              <Text style={styles.alertText}>
                {highParts.map(p => p.label).join(', ')} — consider reducing load and prioritizing recovery
              </Text>
            </View>
          </WindowBox>
        )}

        {/* Body Diagram */}
        <WindowBox
          label="Front View"
          style={{ marginHorizontal: 16 }}
        >
          <View style={styles.diagramInner}>
            <BodyDiagram loads={loads} />
          </View>
        </WindowBox>

        {/* Legend */}
        <View style={styles.legendRow}>
          {[
            { color: C.green, label: 'No strain' },
            { color: C.amber, label: 'Moderate' },
            { color: C.red, label: 'High load' },
          ].map(({ color, label }) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendText}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Body Part Breakdown */}
        <WindowBox label="Load Breakdown" style={{ marginHorizontal: 16 }}>
          <View style={styles.breakdownInner}>
            {BODY_PARTS.map((part, i) => {
              const load = loads[part.id] || 0;
              const thresholds = THRESHOLDS[part.id];
              const color = getColor(C, load, thresholds);
              const bgColor = getBgColor(C, load, thresholds);
              const borderColor = getBorderColor(C, load, thresholds);
              const pct = Math.min(load / thresholds[1], 1);

              return (
                <View key={part.id}>
                  {i > 0 && <View style={styles.breakdownDivider} />}
                  <View style={styles.breakdownRow}>
                    <View style={[styles.breakdownDot, { backgroundColor: color }]} />
                    <Text style={styles.breakdownLabel}>{part.label}</Text>
                    <View style={styles.breakdownBarWrap}>
                      <View style={styles.breakdownTrack}>
                        <View style={[styles.breakdownFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
                      </View>
                    </View>
                    <View style={[styles.breakdownBadge, { borderColor, backgroundColor: bgColor }]}>
                      <Text style={[styles.breakdownBadgeText, { color }]}>
                        {getLabel(load, thresholds)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </WindowBox>

        {/* Summary */}
        <WindowBox label="Summary" style={{ marginHorizontal: 16 }}>
          <View style={styles.summaryInner}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryEyebrow}>Total Load</Text>
              <Text style={styles.summaryBig}>{totalLoad}</Text>
              <Text style={styles.summarySmall}>combined signals</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryEyebrow}>High Parts</Text>
              <Text style={[styles.summaryBig, { color: highParts.length > 0 ? C.red : C.green }]}>
                {highParts.length}
              </Text>
              <Text style={styles.summarySmall}>need attention</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryEyebrow}>Window</Text>
              <Text style={styles.summaryBig}>{window}d</Text>
              <Text style={styles.summarySmall}>of data</Text>
            </View>
          </View>
        </WindowBox>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    scrollContent: { paddingBottom: 48 },

    header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
    greeting: { fontSize: 11, color: C.dust, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
    title: { fontSize: 38, fontWeight: '800', color: C.ink, letterSpacing: -1.5, lineHeight: 42 },

    windowRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12, gap: 10 },
    windowLabel: { fontSize: 10, fontWeight: '800', color: C.dust, letterSpacing: 1, textTransform: 'uppercase' },
    windowBtns: { flexDirection: 'row', gap: 6 },
    windowBtn: { borderWidth: 1.5, borderColor: C.borderLight, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.surface },
    windowBtnActive: { borderColor: C.terraBorder, backgroundColor: C.terraBg },
    windowBtnText: { fontSize: 11, fontWeight: '800', color: C.dust },
    windowBtnTextActive: { color: C.terra },
    updatedText: { fontSize: 9, color: C.dust, marginLeft: 'auto' },

    alertInner: { padding: 14 },
    alertText: { color: C.red, fontSize: 12, fontWeight: '600', lineHeight: 17 },

    diagramInner: { padding: 16, paddingTop: 20, alignItems: 'center' },

    legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 12, paddingHorizontal: 16 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 1 },
    legendText: { fontSize: 10, fontWeight: '700', color: C.dust, letterSpacing: 0.5 },

    breakdownInner: { padding: 16, paddingTop: 20 },
    breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    breakdownDivider: { height: 1, backgroundColor: C.borderLight },
    breakdownDot: { width: 8, height: 8, borderRadius: 1 },
    breakdownLabel: { width: 64, fontSize: 12, fontWeight: '700', color: C.ink },
    breakdownBarWrap: { flex: 1 },
    breakdownTrack: { height: 4, backgroundColor: C.borderLight, borderRadius: 2, overflow: 'hidden' },
    breakdownFill: { height: 4, borderRadius: 2 },
    breakdownBadge: { borderWidth: 1.5, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
    breakdownBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

    summaryInner: { flexDirection: 'row', padding: 18 },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryEyebrow: { fontSize: 9, fontWeight: '800', color: C.dust, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
    summaryBig: { fontSize: 32, fontWeight: '800', color: C.ink, letterSpacing: -1, lineHeight: 36 },
    summarySmall: { fontSize: 9, fontWeight: '600', color: C.dust, marginTop: 2 },
    summaryDivider: { width: 1, backgroundColor: C.borderLight, marginHorizontal: 8 },
  });
}
