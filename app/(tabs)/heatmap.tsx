import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Dimensions, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { BodyOverrides, InjuryEntry, addInjuryEntry, getAlertSettings, getBodyOverrides, getCheckIns, getInjuryLog, getSessions, resolveInjuryEntry, saveBodyOverrides } from '../../storage';
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
  { id: 'back',    label: 'Back',    x: 0.08, y: 0.34, radius: 0.055, lineTo: { x: 0.28, y: 0.32 } },
  { id: 'hip',     label: 'Hip',     x: 0.61, y: 0.48, radius: 0.055 },
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
  back:     [3, 6],
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

function Card({ label, labelColor, accentColor, bgColor, children, style }: {
  label?: string; labelColor?: string; accentColor?: string; bgColor?: string; children?: any; style?: any;
}) {
  const { C } = useTheme();
  const hasAccent = !!accentColor;
  return (
    <View style={[{
      backgroundColor: bgColor || C.surface,
      borderRadius: 20,
      marginBottom: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 12,
      elevation: 3,
      overflow: 'hidden',
    }, style]}>
      {hasAccent && (
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: accentColor, borderTopLeftRadius: 20, borderBottomLeftRadius: 20 }} />
      )}
      {label && (
        <Text style={{
          fontSize: 10,
          fontWeight: '700',
          color: labelColor || C.dust,
          letterSpacing: 1,
          textTransform: 'uppercase',
          paddingHorizontal: hasAccent ? 24 : 20,
          paddingTop: 18,
          paddingBottom: 2,
        }}>{label}</Text>
      )}
      {children}
    </View>
  );
}

function BodyDiagram({ loads, injuries, onPartPress }: { loads: any; injuries: InjuryEntry[]; onPartPress: (part: typeof BODY_PARTS[0]) => void }) {
  const { C } = useTheme();
  const W = DIAGRAM_WIDTH;
  const H = DIAGRAM_HEIGHT;
  const activePartIds = new Set(injuries.filter(i => !i.resolved).map(i => i.partId));
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
        const isInjured = activePartIds.has(part.id);

        return (
          <G key={part.id} onPress={() => onPartPress(part)}>
            {part.lineTo && (
              <Line
                x1={px} y1={py}
                x2={part.lineTo.x * W} y2={part.lineTo.y * H}
                stroke={isInjured ? C.red : color}
                strokeWidth={1.5}
                strokeDasharray="4,3"
                opacity={0.7}
              />
            )}
            <Circle
              cx={px}
              cy={py}
              r={r}
              fill={isInjured ? C.red + '33' : color + '55'}
              stroke={isInjured ? C.red : color}
              strokeWidth={isInjured ? 2.5 : 2}
            />
            {isInjured && (
              <>
                <Line x1={px - r * 0.4} y1={py - r * 0.4} x2={px + r * 0.4} y2={py + r * 0.4}
                  stroke={C.red} strokeWidth={2} strokeLinecap="round" />
                <Line x1={px + r * 0.4} y1={py - r * 0.4} x2={px - r * 0.4} y2={py + r * 0.4}
                  stroke={C.red} strokeWidth={2} strokeLinecap="round" />
              </>
            )}
          </G>
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
  const [alertSettings, setAlertSettings] = useState({ bodyHighLoad: true });
  const [injuryLog, setInjuryLog] = useState<InjuryEntry[]>([]);
  const [selectedPart, setSelectedPart] = useState<typeof BODY_PARTS[0] | null>(null);
  const [injuryNote, setInjuryNote] = useState('');
  const [showInjuryModal, setShowInjuryModal] = useState(false);
  const [overrides, setOverrides] = useState<BodyOverrides>({});

  useFocusEffect(useCallback(() => { loadAll(); }, [window]));

  const loadAll = async () => {
    const [log, ovr] = await Promise.all([getInjuryLog(), getBodyOverrides(), computeLoads()]);
    setInjuryLog(log as InjuryEntry[]);
    setOverrides(ovr as BodyOverrides);
  };

  const computeLoads = async () => {
    const [sessions, checkIns, alertPrefs] = await Promise.all([getSessions(), getCheckIns(), getAlertSettings()]);
    setAlertSettings(alertPrefs);
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

  const handlePartPress = (part: typeof BODY_PARTS[0]) => {
    Haptics.selectionAsync();
    setSelectedPart(part);
    setInjuryNote('');
    setShowInjuryModal(true);
  };

  const handleMarkFine = async () => {
    if (!selectedPart) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const today = new Date().toISOString().split('T')[0];
    const updated = { ...overrides, [selectedPart.id]: today };
    await saveBodyOverrides(updated);
    setOverrides(updated);
    setShowInjuryModal(false);
  };

  const handleRemoveOverride = async () => {
    if (!selectedPart) return;
    Haptics.selectionAsync();
    const updated = { ...overrides };
    delete updated[selectedPart.id];
    await saveBodyOverrides(updated);
    setOverrides(updated);
    setShowInjuryModal(false);
  };

  const handleLogInjury = async () => {
    if (!selectedPart) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const entry: InjuryEntry = {
      id: Date.now().toString(),
      partId: selectedPart.id,
      partName: selectedPart.label,
      note: injuryNote.trim(),
      date: new Date().toISOString().split('T')[0],
      resolved: false,
    };
    await addInjuryEntry(entry);
    setInjuryLog(prev => [...prev, entry]);
    setShowInjuryModal(false);
  };

  const handleResolve = async (id: string) => {
    Haptics.selectionAsync();
    await resolveInjuryEntry(id);
    const today = new Date().toISOString().split('T')[0];
    setInjuryLog(prev => prev.map(e => e.id === id ? { ...e, resolved: true, resolvedDate: today } : e));
  };

  const activeInjuries = injuryLog.filter(e => !e.resolved);

  // Apply overrides — overridden parts show as 0 load
  const effectiveLoads = { ...loads };
  Object.keys(overrides).forEach(partId => { effectiveLoads[partId] = 0; });

  const totalLoad = Object.values(effectiveLoads).reduce((a, b) => a + b, 0);
  const highParts = BODY_PARTS.filter(p => {
    const load = effectiveLoads[p.id] || 0;
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
        {alertSettings.bodyHighLoad && highParts.length > 0 && (
          <Card
            label="⚠ High Load Detected"
            accentColor={C.red}
            bgColor={C.redBg}
            labelColor={C.red}
            style={{ marginHorizontal: 16 }}
          >
            <View style={styles.alertInner}>
              <Text style={styles.alertText}>
                {highParts.map(p => p.label).join(', ')} — consider reducing load and prioritizing recovery
              </Text>
            </View>
          </Card>
        )}

        {/* Body Diagram */}
        <Card
          label="Front View — tap a zone to log an injury"
          style={{ marginHorizontal: 16 }}
        >
          <View style={styles.diagramInner}>
            <BodyDiagram loads={effectiveLoads} injuries={injuryLog} onPartPress={handlePartPress} />
          </View>
        </Card>

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
        <Card label="Load Breakdown" style={{ marginHorizontal: 16 }}>
          <View style={styles.breakdownInner}>
            {BODY_PARTS.map((part, i) => {
              const load = effectiveLoads[part.id] || 0;
              const rawLoad = loads[part.id] || 0;
              const isOverridden = !!overrides[part.id];
              const thresholds = THRESHOLDS[part.id];
              const color = getColor(C, load, thresholds);
              const bgColor = getBgColor(C, load, thresholds);
              const borderColor = getBorderColor(C, load, thresholds);
              const pct = Math.min(load / thresholds[1], 1);
              const activeInjury = activeInjuries.find(e => e.partId === part.id);

              return (
                <View key={part.id}>
                  {i > 0 && <View style={styles.breakdownDivider} />}
                  <View style={styles.breakdownRow}>
                    <View style={[styles.breakdownDot, { backgroundColor: activeInjury ? C.red : color }]} />
                    <Text style={styles.breakdownLabel}>{part.label}</Text>
                    <View style={styles.breakdownBarWrap}>
                      <View style={styles.breakdownTrack}>
                        <View style={[styles.breakdownFill, { width: `${pct * 100}%`, backgroundColor: activeInjury ? C.red : color }]} />
                      </View>
                    </View>
                    <View style={[styles.breakdownBadge, { borderColor: activeInjury ? C.redBorder : borderColor, backgroundColor: activeInjury ? C.redBg : bgColor }]}>
                      <Text style={[styles.breakdownBadgeText, { color: activeInjury ? C.red : color }]}>
                        {activeInjury ? 'Injured' : isOverridden ? 'Feels Fine' : getLabel(load, thresholds)}
                      </Text>
                    </View>
                    {isOverridden && rawLoad > 0 && (
                      <TouchableOpacity
                        style={[styles.breakdownBadge, { borderColor: C.borderLight, backgroundColor: C.surfaceAlt, marginLeft: 4 }]}
                        onPress={() => { setSelectedPart(BODY_PARTS.find(p => p.id === part.id) || null); setShowInjuryModal(true); }}
                      >
                        <Text style={[styles.breakdownBadgeText, { color: C.dust }]}>✕ Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {activeInjury && (
                    <View style={styles.breakdownInjuryRow}>
                      <Text style={styles.breakdownInjuryDate}>Since {activeInjury.date}</Text>
                      {activeInjury.note ? <Text style={styles.breakdownInjuryNote} numberOfLines={1}>{activeInjury.note}</Text> : null}
                      <TouchableOpacity style={styles.breakdownHealBtn} onPress={() => handleResolve(activeInjury.id)}>
                        <Text style={styles.breakdownHealBtnText}>Mark Healed</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </Card>

        {/* Summary */}
        <Card label="Summary" style={{ marginHorizontal: 16 }}>
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
        </Card>

        {/* Active Injuries */}
        {activeInjuries.length > 0 && (
          <Card label="Active Injuries" accentColor={C.red} bgColor={C.redBg} labelColor={C.red} style={{ marginHorizontal: 16 }}>
            <View style={styles.injuryListInner}>
              {activeInjuries.map((entry, i) => (
                <View key={entry.id}>
                  {i > 0 && <View style={styles.injuryDivider} />}
                  <View style={styles.injuryRow}>
                    <View style={styles.injuryInfo}>
                      <Text style={styles.injuryPart}>{entry.partName}</Text>
                      <Text style={styles.injuryDate}>{entry.date}</Text>
                      {entry.note ? <Text style={styles.injuryNote}>{entry.note}</Text> : null}
                    </View>
                    <TouchableOpacity style={styles.resolveBtn} onPress={() => handleResolve(entry.id)}>
                      <Text style={styles.resolveBtnText}>Mark Healed</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Injury History */}
        {injuryLog.filter(e => e.resolved).length > 0 && (
          <Card label="Injury History" style={{ marginHorizontal: 16 }}>
            <View style={styles.injuryListInner}>
              {[...injuryLog].filter(e => e.resolved).reverse().map((entry, i) => (
                <View key={entry.id}>
                  {i > 0 && <View style={{ height: 1, backgroundColor: C.borderLight, marginVertical: 8 }} />}
                  <View style={styles.historyRow}>
                    <View style={[styles.historyDot, { backgroundColor: C.green }]} />
                    <View style={styles.injuryInfo}>
                      <Text style={styles.historyPart}>{entry.partName}</Text>
                      <Text style={styles.historyDate}>Logged {entry.date}{entry.resolvedDate ? ` · Healed ${entry.resolvedDate}` : ' · Healed'}</Text>
                      {entry.note ? <Text style={styles.injuryNote}>{entry.note}</Text> : null}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Injury Log Modal */}
      <Modal visible={showInjuryModal} transparent animationType="slide" onRequestClose={() => setShowInjuryModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{selectedPart?.label}</Text>

            {/* Feeling fine / override section */}
            {selectedPart && overrides[selectedPart.id] ? (
              <>
                <View style={[styles.modalFineTag, { backgroundColor: C.greenBg, borderColor: C.greenBorder }]}>
                  <Text style={[styles.modalFineTagText, { color: C.green }]}>✓ Marked as feeling fine — load ignored</Text>
                </View>
                <TouchableOpacity style={[styles.modalFineBtn, { borderColor: C.borderLight, backgroundColor: C.surfaceAlt }]} onPress={handleRemoveOverride}>
                  <Text style={[styles.modalFineBtnText, { color: C.sand }]}>Remove Override</Text>
                </TouchableOpacity>
              </>
            ) : selectedPart && (loads[selectedPart.id] || 0) > 0 ? (
              <>
                <Text style={styles.modalLoadHint}>
                  {getLabel(loads[selectedPart.id] || 0, THRESHOLDS[selectedPart.id])} load detected — tap below if it feels fine
                </Text>
                <TouchableOpacity style={[styles.modalFineBtn, { borderColor: C.greenBorder, backgroundColor: C.greenBg }]} onPress={handleMarkFine}>
                  <Text style={[styles.modalFineBtnText, { color: C.green }]}>Feels Fine — Clear Load</Text>
                </TouchableOpacity>
              </>
            ) : null}

            <View style={styles.modalDivider} />
            <Text style={styles.modalInjuryLabel}>Log an Injury</Text>
            <TextInput
              style={styles.modalInput}
              value={injuryNote}
              onChangeText={setInjuryNote}
              placeholder="Describe what happened (optional)..."
              placeholderTextColor={C.dust}
              multiline
              numberOfLines={3}
              maxLength={300}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowInjuryModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleLogInjury}>
                <Text style={styles.modalConfirmText}>Log Injury</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    scrollContent: { paddingBottom: 110 },

    header: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 16 },
    greeting: { fontSize: 11, color: C.dust, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
    title: { fontSize: 38, fontWeight: '800', color: C.ink, letterSpacing: -1.5, lineHeight: 42 },

    windowRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12, gap: 10 },
    windowLabel: { fontSize: 10, fontWeight: '800', color: C.dust, letterSpacing: 1, textTransform: 'uppercase' },
    windowBtns: { flexDirection: 'row', gap: 6 },
    windowBtn: { borderWidth: 1, borderColor: C.borderLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.surface },
    windowBtnActive: { borderColor: C.terraBorder, backgroundColor: C.terraBg },
    windowBtnText: { fontSize: 11, fontWeight: '800', color: C.dust },
    windowBtnTextActive: { color: C.terra },
    updatedText: { fontSize: 9, color: C.dust, marginLeft: 'auto' },

    alertInner: { padding: 14, paddingLeft: 24 },
    alertText: { color: C.red, fontSize: 12, fontWeight: '600', lineHeight: 17 },

    diagramInner: { padding: 16, paddingTop: 14, alignItems: 'center' },

    legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 12, paddingHorizontal: 16 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 10, fontWeight: '700', color: C.dust, letterSpacing: 0.5 },

    breakdownInner: { padding: 16, paddingTop: 14 },
    breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    breakdownDivider: { height: 1, backgroundColor: C.borderLight },
    breakdownDot: { width: 8, height: 8, borderRadius: 4 },
    breakdownLabel: { width: 64, fontSize: 12, fontWeight: '700', color: C.ink },
    breakdownBarWrap: { flex: 1 },
    breakdownTrack: { height: 6, backgroundColor: C.borderLight, borderRadius: 3, overflow: 'hidden' },
    breakdownFill: { height: 6, borderRadius: 3 },
    breakdownBadge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    breakdownBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

    summaryInner: { flexDirection: 'row', padding: 18 },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryEyebrow: { fontSize: 9, fontWeight: '800', color: C.dust, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
    summaryBig: { fontSize: 32, fontWeight: '800', color: C.ink, letterSpacing: -1, lineHeight: 36 },
    summarySmall: { fontSize: 9, fontWeight: '600', color: C.dust, marginTop: 2 },
    summaryDivider: { width: 1, backgroundColor: C.borderLight, marginHorizontal: 8 },

    breakdownInjuryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 18, paddingBottom: 8, flexWrap: 'wrap' },
    breakdownInjuryDate: { fontSize: 10, fontWeight: '600', color: C.red + 'aa', letterSpacing: 0.3 },
    breakdownInjuryNote: { flex: 1, fontSize: 10, color: C.dust, fontStyle: 'italic' },
    breakdownHealBtn: { borderWidth: 1, borderColor: C.greenBorder, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: C.greenBg },
    breakdownHealBtnText: { fontSize: 9, fontWeight: '800', color: C.green, letterSpacing: 0.5 },

    injuryListInner: { padding: 16, paddingTop: 14 },
    injuryDivider: { height: 1, backgroundColor: C.redBorder + '55', marginVertical: 8 },
    injuryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    injuryInfo: { flex: 1 },
    injuryPart: { fontSize: 13, fontWeight: '800', color: C.red },
    injuryDate: { fontSize: 10, fontWeight: '600', color: C.red + 'aa', marginTop: 1, letterSpacing: 0.5 },
    injuryNote: { fontSize: 12, color: C.inkLight, marginTop: 4, lineHeight: 17 },
    resolveBtn: { borderWidth: 1, borderColor: C.redBorder, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
    resolveBtnText: { fontSize: 10, fontWeight: '800', color: C.red, letterSpacing: 0.5 },

    historyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
    historyDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
    historyPart: { fontSize: 13, fontWeight: '700', color: C.inkLight },
    historyDate: { fontSize: 10, fontWeight: '600', color: C.green, marginTop: 1, letterSpacing: 0.3 },

    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
    modalSheet: { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 14 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderLight, alignSelf: 'center', marginBottom: 8 },
    modalTitle: { fontSize: 22, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
    modalLoadHint: { fontSize: 12, color: C.dust, marginTop: -6 },
    modalFineTag: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
    modalFineTagText: { fontSize: 12, fontWeight: '700' },
    modalFineBtn: { borderWidth: 1.5, borderRadius: 12, padding: 14, alignItems: 'center' },
    modalFineBtnText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
    modalDivider: { height: 1, backgroundColor: C.borderLight },
    modalInjuryLabel: { fontSize: 11, fontWeight: '800', color: C.dust, letterSpacing: 1, textTransform: 'uppercase', marginBottom: -4 },
    modalInput: { backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.borderLight, borderRadius: 12, padding: 14, color: C.ink, fontSize: 13, lineHeight: 20, minHeight: 80, textAlignVertical: 'top' },
    modalBtns: { flexDirection: 'row', gap: 10 },
    modalCancel: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.borderLight, alignItems: 'center' },
    modalCancelText: { fontSize: 13, fontWeight: '700', color: C.sand },
    modalConfirm: { flex: 2, padding: 14, borderRadius: 12, backgroundColor: C.red, alignItems: 'center' },
    modalConfirmText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  });
}
