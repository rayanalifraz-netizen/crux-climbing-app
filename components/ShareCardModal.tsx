import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { GRADE_COLORS } from '../context/ThemeContext';
import type { CheckIn, Session } from '../storage';

// ─── Colour tokens (always light — cards are for sharing externally) ─────────

const P = {
  bg:     '#F2F0ED',
  ink:    '#1A1714',
  inkDk:  '#0E0C0A',
  sand:   '#8A837A',
  dust:   '#B8B0A8',
  border: '#E8E6E1',
  terra:  '#C8622A',
  amber:  '#D4880A',
  red:    '#E03030',
  green:  '#2DA06B',
};

function resColor(res: number) {
  if (res <= 40) return P.terra;
  if (res <= 70) return P.amber;
  return P.red;
}
function resLabel(res: number) {
  if (res <= 40) return 'Light';
  if (res <= 70) return 'Moderate';
  return 'Hard';
}
function drsColor(drs: number) {
  if (drs >= 70) return P.terra;
  if (drs >= 40) return P.amber;
  return P.red;
}
function drsLabel(drs: number) {
  if (drs >= 70) return 'Train Hard';
  if (drs >= 40) return 'Take it Easy';
  return 'Rest Day';
}
function gradeColor(g: string) { return GRADE_COLORS[g] || P.sand; }

function fmt(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({ session, date }: { session: Session; date: string }) {
  const color = resColor(session.res);
  // use individual climb entries if available, else fall back to gradeData
  const grades = session.climbs && session.climbs.length > 0
    ? session.climbs
    : Object.entries(session.gradeData || {})
        .filter(([, e]) => e.attempts > 0)
        .map(([grade, e]) => ({ id: grade, grade, attempts: e.attempts, sends: e.sends }));
  const totalAttempts = grades.reduce((a, e) => a + e.attempts, 0);

  return (
    <View style={sc.card}>
      {/* Header */}
      <View style={sc.header}>
        <Text style={sc.wordmark}>CRUX</Text>
        <Text style={sc.date}>{fmt(date)}</Text>
      </View>

      {/* Intensity pill + attempts */}
      <View style={sc.topRow}>
        <View style={[sc.intensityPill, { backgroundColor: color + '20', borderColor: color + '60' }]}>
          <Text style={[sc.intensityText, { color }]}>{resLabel(session.res)} Session</Text>
        </View>
        <Text style={sc.attempts}>{totalAttempts} attempts</Text>
      </View>

      {/* RES score */}
      <View style={sc.scoreSection}>
        <Text style={[sc.scoreNum, { color }]}>{session.res}</Text>
        <Text style={sc.scoreLabel}>RES</Text>
        <Text style={sc.scoreDesc}>Relative Exertion Score</Text>
      </View>

      <View style={sc.rule} />

      {/* Grades */}
      {grades.length > 0 && (
        <View style={sc.block}>
          <Text style={sc.blockLabel}>Grades</Text>
          <View style={sc.chipRow}>
            {grades.map(entry => {
              const color = gradeColor(entry.grade);
              let label: string;
              if (entry.attempts === 1 && entry.sends === 1) label = `${entry.grade} · Flash`;
              else if (entry.sends >= 1) label = `${entry.grade} · ${entry.attempts} att · Sent ✓`;
              else label = `${entry.grade} · ${entry.attempts} att`;
              return (
                <View key={entry.id} style={[sc.gradeChip, { borderColor: color + '50', backgroundColor: color + '15' }]}>
                  <Text style={[sc.gradeChipText, { color }]}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Holds + Movements */}
      {(session.holdTypes?.length > 0 || session.movementTypes?.length > 0) && (
        <View style={sc.block}>
          <Text style={sc.blockLabel}>Style</Text>
          <View style={sc.chipRow}>
            {[...(session.holdTypes || []), ...(session.movementTypes || [])].map(tag => (
              <View key={tag} style={sc.tagChip}>
                <Text style={sc.tagChipText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Notes */}
      {!!session.notes && (
        <View style={sc.notesBlock}>
          <Text style={sc.notesText} numberOfLines={2}>"{session.notes}"</Text>
        </View>
      )}

      {/* Footer */}
      <View style={sc.footer}>
        <View style={[sc.footerAccent, { backgroundColor: color }]} />
        <Text style={sc.footerText}>Tracked with Crux · Climbing Recovery</Text>
      </View>
    </View>
  );
}

const sc = StyleSheet.create({
  card: {
    width: 340,
    backgroundColor: '#1A1714',
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 0,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  wordmark: { fontSize: 13, fontWeight: '900', color: P.terra, letterSpacing: 3, textTransform: 'uppercase' },
  date: { fontSize: 11, fontWeight: '600', color: '#6A6560', letterSpacing: 0.5 },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  intensityPill: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  intensityText: { fontSize: 11, fontWeight: '800' },
  attempts: { fontSize: 11, color: '#6A6560', fontWeight: '600' },

  scoreSection: { alignItems: 'center', marginBottom: 24 },
  scoreNum: { fontSize: 80, fontWeight: '900', letterSpacing: -4, lineHeight: 84 },
  scoreLabel: { fontSize: 13, fontWeight: '800', color: '#6A6560', letterSpacing: 3, textTransform: 'uppercase', marginTop: -4 },
  scoreDesc: { fontSize: 10, color: '#4A4540', fontWeight: '600', letterSpacing: 0.5, marginTop: 4 },

  rule: { height: 1, backgroundColor: '#2E2C28', marginBottom: 16 },

  block: { marginBottom: 14 },
  blockLabel: { fontSize: 9, fontWeight: '800', color: '#4A4540', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gradeChip: { flexDirection: 'row', alignItems: 'center', gap: 2, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  gradeChipText: { fontSize: 12, fontWeight: '800' },
  gradeChipCount: { fontSize: 11 },
  tagChip: { borderWidth: 1, borderColor: '#3A3830', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  tagChipText: { fontSize: 11, fontWeight: '600', color: '#8A837A' },

  notesBlock: { marginBottom: 16, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#3A3830' },
  notesText: { fontSize: 12, color: '#6A6560', lineHeight: 18, fontStyle: 'italic' },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, marginTop: 4, borderTopWidth: 1, borderTopColor: '#2A2824' },
  footerAccent: { width: 3, height: 3, borderRadius: 1.5 },
  footerText: { fontSize: 10, color: '#4A4540', fontWeight: '600', letterSpacing: 0.3 },
});

// ─── Recovery Card ────────────────────────────────────────────────────────────

type CHIData = { chi: number; readiness: number; load: number; injury: number };

function RecoveryCard({
  checkIn,
  date,
  streak,
  chiData,
}: {
  checkIn: CheckIn;
  date: string;
  streak: { current: number; last7: boolean[] };
  chiData?: CHIData;
}) {
  const isRest = checkIn.isRestDay;
  const drs = isRest ? null : computeDRS(checkIn);
  const color = isRest ? P.green : drsColor(drs!);
  const verdict = isRest ? 'Rest Day' : drsLabel(drs!);

  return (
    <View style={rc.card}>
      {/* Header */}
      <View style={rc.header}>
        <Text style={rc.wordmark}>CRUX</Text>
        <Text style={rc.date}>{fmt(date)}</Text>
      </View>

      {/* Verdict + DRS */}
      <View style={rc.scoreSection}>
        <View style={[rc.verdictPill, { backgroundColor: color + '18', borderColor: color + '50' }]}>
          <Text style={[rc.verdictText, { color }]}>{verdict}</Text>
        </View>
        {isRest ? (
          <Text style={rc.restMsg}>Recovery mode — no session today</Text>
        ) : (
          <>
            <Text style={[rc.scoreNum, { color }]}>{drs}</Text>
            <Text style={rc.scoreLabel}>Daily Readiness Score</Text>
          </>
        )}
      </View>

      <View style={rc.rule} />

      {/* Streak */}
      <View style={rc.streakBlock}>
        <View style={rc.streakRow}>
          {streak.last7.map((active, i) => (
            <View
              key={i}
              style={[rc.streakDot, active ? { backgroundColor: P.terra } : { backgroundColor: P.dust + '40' }]}
            />
          ))}
        </View>
        <Text style={rc.streakLabel}>
          {streak.current > 0 ? `${streak.current}-day check-in streak` : 'Start your streak today'}
        </Text>
      </View>

      {/* CHI breakdown */}
      {chiData && (
        <>
          <View style={rc.rule} />
          <View style={rc.chiBlock}>
            <View style={rc.chiHeader}>
              <Text style={rc.chiTitle}>Climber Health Index</Text>
              <Text style={[rc.chiScore, {
                color: chiData.chi >= 80 ? P.green : chiData.chi >= 65 ? P.terra : chiData.chi >= 45 ? P.amber : P.red
              }]}>{chiData.chi}</Text>
            </View>
            <View style={rc.chiBars}>
              {[
                { label: 'Readiness', val: chiData.readiness },
                { label: 'Load', val: chiData.load },
                { label: 'Injury Status', val: chiData.injury },
              ].map(item => {
                const bc = item.val >= 80 ? P.green : item.val >= 55 ? P.amber : P.red;
                return (
                  <View key={item.label} style={rc.barRow}>
                    <Text style={rc.barLabel}>{item.label}</Text>
                    <View style={rc.barTrack}>
                      <View style={[rc.barFill, { width: `${item.val}%`, backgroundColor: bc }]} />
                    </View>
                    <Text style={[rc.barVal, { color: bc }]}>{item.val}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </>
      )}

      {/* Body check summary */}
      {!checkIn.isRestDay && (checkIn.affectedFingers?.length > 0 || checkIn.painAreas?.length > 0) && (
        <>
          <View style={rc.rule} />
          <View style={rc.bodyBlock}>
            <Text style={rc.bodyLabel}>Monitoring</Text>
            <View style={rc.chipRow}>
              {checkIn.affectedFingers?.length > 0 && (
                <View style={rc.bodyChip}>
                  <Text style={rc.bodyChipText}>Fingers</Text>
                </View>
              )}
              {checkIn.painAreas?.map(area => (
                <View key={area} style={rc.bodyChip}>
                  <Text style={rc.bodyChipText}>{area.charAt(0).toUpperCase() + area.slice(1)}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}

      {/* Footer */}
      <View style={rc.footer}>
        <View style={[rc.footerAccent, { backgroundColor: color }]} />
        <Text style={rc.footerText}>Tracked with Crux · Climbing Recovery</Text>
      </View>
    </View>
  );
}

function computeDRS(ci: CheckIn): number {
  let score = 100;
  const s = parseInt(ci.soreness || '0');
  if (s >= 8) score -= 40; else if (s >= 6) score -= 25; else if (s >= 4) score -= 10;
  const p = ci.painAreas?.length || 0;
  if (p >= 3) score -= 30; else if (p >= 2) score -= 20; else if (p >= 1) score -= 10;
  const f = ci.affectedFingers?.length || 0;
  if (f >= 3) score -= 20; else if (f >= 1) score -= 10;
  return Math.min(Math.max(score, 0), 100);
}

const rc = StyleSheet.create({
  card: {
    width: 340,
    backgroundColor: P.bg,
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 0,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  wordmark: { fontSize: 13, fontWeight: '900', color: P.terra, letterSpacing: 3, textTransform: 'uppercase' },
  date: { fontSize: 11, fontWeight: '600', color: P.dust, letterSpacing: 0.5 },

  scoreSection: { alignItems: 'center', marginBottom: 20 },
  verdictPill: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 12 },
  verdictText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  scoreNum: { fontSize: 76, fontWeight: '900', letterSpacing: -3, lineHeight: 80 },
  scoreLabel: { fontSize: 10, fontWeight: '700', color: P.dust, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 },
  restMsg: { fontSize: 13, color: P.sand, marginTop: 12, textAlign: 'center' },

  rule: { height: 1, backgroundColor: P.border, marginBottom: 16, marginTop: 4 },

  streakBlock: { alignItems: 'center', marginBottom: 16 },
  streakRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  streakDot: { width: 10, height: 10, borderRadius: 5 },
  streakLabel: { fontSize: 11, fontWeight: '700', color: P.sand, letterSpacing: 0.3 },

  chiBlock: { marginBottom: 16 },
  chiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  chiTitle: { fontSize: 11, fontWeight: '700', color: P.sand, letterSpacing: 0.5 },
  chiScore: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  chiBars: { gap: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { fontSize: 10, fontWeight: '600', color: P.dust, width: 72 },
  barTrack: { flex: 1, height: 4, backgroundColor: P.border, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  barVal: { fontSize: 11, fontWeight: '800', width: 24, textAlign: 'right' },

  bodyBlock: { marginBottom: 16 },
  bodyLabel: { fontSize: 9, fontWeight: '800', color: P.dust, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bodyChip: { borderWidth: 1, borderColor: P.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  bodyChipText: { fontSize: 11, fontWeight: '600', color: P.sand },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, marginTop: 4, borderTopWidth: 1, borderTopColor: P.border },
  footerAccent: { width: 3, height: 3, borderRadius: 1.5 },
  footerText: { fontSize: 10, color: P.dust, fontWeight: '600', letterSpacing: 0.3 },
});

// ─── Modal wrapper ────────────────────────────────────────────────────────────

type ShareCardModalProps =
  | { visible: boolean; onClose: () => void; type: 'session'; session: Session; date: string }
  | { visible: boolean; onClose: () => void; type: 'recovery'; checkIn: CheckIn; date: string; streak: { current: number; last7: boolean[] }; chiData?: CHIData };

export default function ShareCardModal(props: ShareCardModalProps) {
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    try {
      setSharing(true);
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your climbing data' });
    } catch (e) {
      console.error('Share failed', e);
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <View style={ms.overlay}>
        <View style={ms.sheet}>
          {/* Sheet header */}
          <View style={ms.sheetHeader}>
            <Text style={ms.sheetTitle}>Share Card</Text>
            <TouchableOpacity onPress={props.onClose} style={ms.closeBtn}>
              <Text style={ms.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Card preview */}
          <View style={ms.previewWrap}>
            <View ref={cardRef} collapsable={false}>
              {props.type === 'session' ? (
                <SessionCard session={props.session} date={props.date} />
              ) : (
                <RecoveryCard
                  checkIn={props.checkIn}
                  date={props.date}
                  streak={props.streak}
                  chiData={props.chiData}
                />
              )}
            </View>
          </View>

          {/* Share button */}
          <View style={ms.btnWrap}>
            <TouchableOpacity style={ms.shareBtn} onPress={handleShare} disabled={sharing}>
              {sharing
                ? <ActivityIndicator color="#F2F0ED" />
                : <Text style={ms.shareBtnText}>Share →</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(26,21,16,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#F2F0ED', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', paddingBottom: 48 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1A1714', paddingHorizontal: 20, paddingVertical: 16 },
  sheetTitle: { fontSize: 13, fontWeight: '800', color: '#F2F0ED', letterSpacing: 0.5 },
  closeBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(242,240,237,0.15)', justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 12, fontWeight: '800', color: '#F2F0ED' },
  previewWrap: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  btnWrap: { paddingHorizontal: 24 },
  shareBtn: { backgroundColor: '#1A1714', borderRadius: 14, padding: 16, alignItems: 'center' },
  shareBtnText: { color: '#F2F0ED', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
});
