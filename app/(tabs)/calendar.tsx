import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { deleteGoalDate, getCheckIns, getGoalDate, getSessions, saveGoalDate } from '../../storage';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:         '#1a1510',
  surface:    '#221e18',
  surfaceAlt: '#2a2420',
  border:     '#36302a',
  chalk:      '#f0ebe3',
  sand:       '#a89880',
  dust:       '#6a5e52',
  terra:      '#c4734a',
  terraLight: '#d4896a',
  terraBg:    '#2a1e16',
  terraDark:  '#8a4a2a',
  amber:      '#d4943a',
  amberBg:    '#261e10',
  red:        '#c44a3a',
  redBg:      '#241410',
  green:      '#6a9a5a',
  greenBg:    '#16201a',
  goal:       '#9a6abf',
  goalBg:     '#1e1628',
};

function getResColor(res) {
  if (!res && res !== 0) return null;
  if (res <= 40) return C.terra;
  if (res <= 70) return C.amber;
  return C.red;
}

function getResLabel(res) {
  if (res <= 40) return 'Light';
  if (res <= 70) return 'Moderate';
  return 'Hard';
}

function formatDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function getDaysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const goal = new Date(dateStr + 'T00:00:00');
  return Math.round((goal - today) / (1000 * 60 * 60 * 24));
}

function formatGoalDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function CalendarScreen() {
  const [sessions, setSessions] = useState({});
  const [checkIns, setCheckIns] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [goalDate, setGoalDate] = useState(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalPickerMonth, setGoalPickerMonth] = useState(new Date());

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    const [sessionData, checkInData, savedGoal] = await Promise.all([
      getSessions(), getCheckIns(), getGoalDate(),
    ]);
    setSessions(sessionData);
    setCheckIns(checkInData);
    if (savedGoal) setGoalDate(savedGoal);
  };

  const handleSaveGoalDate = async (dateStr) => {
    await saveGoalDate(dateStr);
    setGoalDate(dateStr);
    setShowGoalModal(false);
  };

  const handleClearGoalDate = async () => {
    await deleteGoalDate();
    setGoalDate(null);
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonth = () => { setCurrentMonth(new Date(year, month - 1, 1)); setSelectedDate(null); };
  const nextMonth = () => { setCurrentMonth(new Date(year, month + 1, 1)); setSelectedDate(null); };

  const gpYear = goalPickerMonth.getFullYear();
  const gpMonth = goalPickerMonth.getMonth();
  const gpFirstDay = new Date(gpYear, gpMonth, 1).getDay();
  const gpDaysInMonth = new Date(gpYear, gpMonth + 1, 0).getDate();

  const selectedSession = selectedDate ? sessions[selectedDate] : null;
  const selectedCheckIn = selectedDate ? checkIns[selectedDate] : null;
  const isRestDay = selectedCheckIn?.isRestDay;
  const daysUntilGoal = goalDate ? getDaysUntil(goalDate) : null;
  const todayStr = formatDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const totalSessions = Object.keys(sessions).length;
  const hardSessions = Object.values(sessions).filter(s => s.res > 70).length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Training Log</Text>
            <Text style={styles.title}>History</Text>
            <View style={styles.headerRule} />
          </View>
          <View style={styles.headerStats}>
            <View style={styles.headerStat}>
              <Text style={styles.headerStatValue}>{totalSessions}</Text>
              <Text style={styles.headerStatLabel}>Total</Text>
            </View>
            <View style={styles.headerStatDivider} />
            <View style={styles.headerStat}>
              <Text style={[styles.headerStatValue, { color: C.red }]}>{hardSessions}</Text>
              <Text style={styles.headerStatLabel}>Hard</Text>
            </View>
          </View>
        </View>

        {/* Goal Date Banner */}
        {goalDate ? (
          <View style={styles.goalBanner}>
            <View style={styles.goalBannerIcon}>
              <Ionicons name="flag-outline" size={18} color={C.goal} />
            </View>
            <View style={styles.goalBannerContent}>
              <Text style={styles.goalBannerEyebrow}>Project Goal</Text>
              <Text style={styles.goalBannerDate}>{formatGoalDate(goalDate)}</Text>
              <Text style={styles.goalBannerCountdown}>
                {daysUntilGoal > 0 ? `${daysUntilGoal} days to go` :
                 daysUntilGoal === 0 ? 'Goal date is today' : 'Goal date has passed'}
              </Text>
            </View>
            <View style={styles.goalBannerActions}>
              <TouchableOpacity onPress={() => { setGoalPickerMonth(new Date()); setShowGoalModal(true); }} style={styles.goalActionBtn}>
                <Ionicons name="pencil-outline" size={13} color={C.goal} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClearGoalDate} style={styles.goalActionBtn}>
                <Ionicons name="close-outline" size={13} color={C.dust} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.setGoalBtn} onPress={() => { setGoalPickerMonth(new Date()); setShowGoalModal(true); }}>
            <Ionicons name="flag-outline" size={14} color={C.goal} />
            <Text style={styles.setGoalBtnText}>Set Project Goal Date</Text>
          </TouchableOpacity>
        )}

        {/* Goal Date Picker Modal */}
        <Modal visible={showGoalModal} animationType="slide" transparent>
          <View style={modalStyles.overlay}>
            <View style={modalStyles.container}>
              <View style={modalStyles.handle} />
              <TouchableOpacity onPress={() => setShowGoalModal(false)} style={modalStyles.closeBtn}>
                <Ionicons name="close" size={18} color={C.dust} />
              </TouchableOpacity>
              <Text style={modalStyles.title}>Set Goal Date</Text>
              <Text style={modalStyles.subtitle}>When do you want to send your project?</Text>

              <View style={modalStyles.monthNav}>
                <TouchableOpacity onPress={() => setGoalPickerMonth(new Date(gpYear, gpMonth - 1, 1))} style={modalStyles.navBtn}>
                  <Ionicons name="chevron-back" size={16} color={C.chalk} />
                </TouchableOpacity>
                <Text style={modalStyles.monthTitle}>{MONTHS[gpMonth]} {gpYear}</Text>
                <TouchableOpacity onPress={() => setGoalPickerMonth(new Date(gpYear, gpMonth + 1, 1))} style={modalStyles.navBtn}>
                  <Ionicons name="chevron-forward" size={16} color={C.chalk} />
                </TouchableOpacity>
              </View>

              <View style={modalStyles.dayHeaders}>
                {DAYS.map(day => <Text key={day} style={modalStyles.dayHeader}>{day}</Text>)}
              </View>

              <View style={modalStyles.grid}>
                {Array.from({ length: gpFirstDay }).map((_, i) => (
                  <View key={`empty-${i}`} style={modalStyles.emptyCell} />
                ))}
                {Array.from({ length: gpDaysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = formatDate(gpYear, gpMonth, day);
                  const isPast = dateStr < todayStr;
                  const isGoal = dateStr === goalDate;
                  return (
                    <TouchableOpacity
                      key={dateStr}
                      style={[modalStyles.cell, isPast && modalStyles.cellPast, isGoal && modalStyles.cellGoal]}
                      onPress={() => !isPast && handleSaveGoalDate(dateStr)}
                      disabled={isPast}
                    >
                      <Text style={[modalStyles.cellText, isPast && modalStyles.cellTextPast, isGoal && modalStyles.cellTextGoal]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </Modal>

        {/* Calendar Card */}
        <View style={styles.calendarCard}>
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={16} color={C.chalk} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={16} color={C.chalk} />
            </TouchableOpacity>
          </View>

          <View style={styles.dayHeaders}>
            {DAYS.map(day => <Text key={day} style={styles.dayHeader}>{day}</Text>)}
          </View>

          <View style={styles.grid}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.emptyCell} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = formatDate(year, month, day);
              const session = sessions[dateStr];
              const checkIn = checkIns[dateStr];
              const restDay = checkIn?.isRestDay;
              const isSelected = selectedDate === dateStr;
              const isToday = dateStr === todayStr;
              const isGoalDay = dateStr === goalDate;
              const dotColor = restDay ? C.green : session ? getResColor(session.res) : null;
              const hasActivity = restDay || !!session;

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.cell,
                    hasActivity && { backgroundColor: (dotColor || C.dust) + '22', borderColor: (dotColor || C.dust) + '55' },
                    isSelected && styles.cellSelected,
                    isToday && !isSelected && styles.cellToday,
                    isGoalDay && styles.cellGoal,
                  ]}
                  onPress={() => setSelectedDate(isSelected ? null : dateStr)}
                >
                  <Text style={[
                    styles.cellText,
                    isToday && styles.cellTextToday,
                    isGoalDay && styles.cellTextGoal,
                    isSelected && styles.cellTextSelected,
                  ]}>{day}</Text>
                  {hasActivity && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
                  {isGoalDay && !hasActivity && <View style={[styles.dot, { backgroundColor: C.goal }]} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            {[
              { color: C.green, label: 'Rest' },
              { color: C.terra, label: 'Light' },
              { color: C.amber, label: 'Moderate' },
              { color: C.red, label: 'Hard' },
              { color: C.goal, label: 'Goal' },
            ].map(({ color, label }) => (
              <View key={label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Empty state */}
        {!selectedDate && totalSessions === 0 && Object.keys(checkIns).length === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={36} color={C.border} />
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptyText}>Your training history will appear here after your first session.</Text>
          </View>
        )}

        {!selectedDate && (totalSessions > 0 || Object.keys(checkIns).length > 0) && (
          <Text style={styles.hintText}>— Tap a highlighted day to view details —</Text>
        )}

        {/* Detail Card */}
        {selectedDate && (isRestDay || selectedSession) && (
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailEyebrow}>
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric'
                  })}
                </Text>
                {isRestDay && (
                  <View style={styles.restBadge}>
                    <Ionicons name="bed-outline" size={11} color={C.green} />
                    <Text style={styles.restBadgeText}>Rest Day</Text>
                  </View>
                )}
              </View>
              {selectedSession && (
                <View style={[styles.resCircle, { borderColor: getResColor(selectedSession.res) + '50' }]}>
                  <Text style={[styles.resCircleScore, { color: getResColor(selectedSession.res) }]}>
                    {selectedSession.res}
                  </Text>
                  <Text style={[styles.resCircleLabel, { color: getResColor(selectedSession.res) + '88' }]}>RES</Text>
                </View>
              )}
            </View>

            {selectedSession && (
              <>
                <View style={styles.detailIntensityRow}>
                  <View style={[styles.intensityBadge, {
                    backgroundColor: getResColor(selectedSession.res) + '20',
                    borderColor: getResColor(selectedSession.res) + '40'
                  }]}>
                    <Text style={[styles.intensityBadgeText, { color: getResColor(selectedSession.res) }]}>
                      {getResLabel(selectedSession.res)} Session
                    </Text>
                  </View>
                  <Text style={styles.detailAttempts}>
                    {Object.values(selectedSession.gradeCounts || {}).reduce((a, b) => a + b, 0)} attempts
                  </Text>
                </View>

                <View style={styles.detailDivider} />

                <Text style={styles.detailSectionLabel}>Grades</Text>
                <View style={styles.chipRow}>
                  {Object.entries(selectedSession.gradeCounts || {}).map(([grade, count]) => (
                    <View key={grade} style={styles.gradeChip}>
                      <Text style={styles.gradeChipGrade}>{grade}</Text>
                      <Text style={styles.gradeChipCount}>×{count}</Text>
                    </View>
                  ))}
                </View>

                {selectedSession.holdTypes?.length > 0 && (
                  <>
                    <Text style={styles.detailSectionLabel}>Holds</Text>
                    <View style={styles.chipRow}>
                      {selectedSession.holdTypes.map(h => (
                        <View key={h} style={styles.holdChip}>
                          <Text style={styles.holdChipText}>{h}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {selectedSession.movementTypes?.length > 0 && (
                  <>
                    <Text style={styles.detailSectionLabel}>Movements</Text>
                    <View style={styles.chipRow}>
                      {selectedSession.movementTypes.map(m => (
                        <View key={m} style={styles.moveChip}>
                          <Text style={styles.moveChipText}>{m}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {selectedSession.notes ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.detailSectionLabel}>Notes</Text>
                    <Text style={styles.notesText}>{selectedSession.notes}</Text>
                  </View>
                ) : null}
              </>
            )}

            {isRestDay && !selectedSession && (
              <Text style={styles.restDayMsg}>— Recovery logged, no session this day —</Text>
            )}
          </View>
        )}

        {selectedDate && !isRestDay && !selectedSession && (
          <View style={styles.emptyDayCard}>
            <Text style={styles.emptyDayText}>No activity logged for this day</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { padding: 20, paddingBottom: 48 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16, marginBottom: 24, gap: 12 },
  greeting: { fontSize: 12, color: C.dust, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  title: { fontSize: 36, fontWeight: '800', color: C.chalk, letterSpacing: -1, lineHeight: 40 },
  headerRule: { height: 1, backgroundColor: C.border, marginTop: 14 },
  headerStats: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, padding: 12, gap: 12, borderWidth: 1, borderColor: C.border, marginTop: 8 },
  headerStat: { alignItems: 'center' },
  headerStatValue: { color: C.chalk, fontSize: 18, fontWeight: '800' },
  headerStatLabel: { color: C.dust, fontSize: 9, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2 },
  headerStatDivider: { width: 1, height: 24, backgroundColor: C.border },

  goalBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.goalBg, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.goal + '40', gap: 12 },
  goalBannerIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.goal + '20', justifyContent: 'center', alignItems: 'center' },
  goalBannerContent: { flex: 1 },
  goalBannerEyebrow: { fontSize: 9, fontWeight: '700', color: C.goal, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 },
  goalBannerDate: { color: C.chalk, fontSize: 14, fontWeight: '700' },
  goalBannerCountdown: { color: C.goal + 'cc', fontSize: 11, marginTop: 2 },
  goalBannerActions: { gap: 5 },
  goalActionBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.surfaceAlt, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },

  setGoalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.goalBg, borderRadius: 12, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: C.goal + '30' },
  setGoalBtnText: { color: C.goal, fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },

  calendarCard: { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { width: 32, height: 32, backgroundColor: C.surfaceAlt, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  monthTitle: { color: C.chalk, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  dayHeaders: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  dayHeader: { color: C.dust, fontSize: 10, fontWeight: '700', width: '14.28%', textAlign: 'center', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  emptyCell: { width: '14.28%', aspectRatio: 1 },
  cell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 6, borderWidth: 1, borderColor: 'transparent', marginBottom: 2 },
  cellSelected: { backgroundColor: C.surfaceAlt, borderColor: C.sand + '60' },
  cellToday: { borderColor: C.terra + '80' },
  cellGoal: { backgroundColor: C.goalBg, borderColor: C.goal + '60' },
  cellText: { color: C.dust, fontSize: 12, fontWeight: '500' },
  cellTextToday: { color: C.terra, fontWeight: '800' },
  cellTextGoal: { color: C.goal, fontWeight: '700' },
  cellTextSelected: { color: C.chalk, fontWeight: '700' },
  dot: { width: 3, height: 3, borderRadius: 2, marginTop: 1 },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 5, height: 5, borderRadius: 3 },
  legendText: { color: C.dust, fontSize: 9, fontWeight: '600', letterSpacing: 0.5 },

  emptyCard: { backgroundColor: C.surface, borderRadius: 14, padding: 36, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.border },
  emptyTitle: { color: C.dust, fontSize: 15, fontWeight: '700', marginTop: 8 },
  emptyText: { color: C.dust, fontSize: 12, textAlign: 'center', lineHeight: 18, opacity: 0.6 },
  hintText: { color: C.dust, textAlign: 'center', fontSize: 10, marginBottom: 8, letterSpacing: 0.5, opacity: 0.6 },

  detailCard: { backgroundColor: C.surface, borderRadius: 14, padding: 18, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  detailEyebrow: { color: C.sand, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  restBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.greenBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: C.green + '30' },
  restBadgeText: { color: C.green, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  resCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  resCircleScore: { fontSize: 15, fontWeight: '800', lineHeight: 17 },
  resCircleLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  detailIntensityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  intensityBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  intensityBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  detailAttempts: { color: C.dust, fontSize: 12 },
  detailDivider: { height: 1, backgroundColor: C.border, marginBottom: 14 },
  detailSectionLabel: { color: C.dust, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 12 },
  gradeChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.terraBg, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: C.terra + '40' },
  gradeChipGrade: { color: C.terra, fontSize: 12, fontWeight: '700' },
  gradeChipCount: { color: C.terraDark, fontSize: 11 },
  holdChip: { backgroundColor: C.surfaceAlt, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: C.border },
  holdChipText: { color: C.sand, fontSize: 12 },
  moveChip: { backgroundColor: C.amberBg, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: C.amber + '30' },
  moveChipText: { color: C.amber, fontSize: 12 },
  notesBox: { backgroundColor: C.surfaceAlt, borderRadius: 8, padding: 12, marginTop: 4, borderWidth: 1, borderColor: C.border },
  notesText: { color: C.sand, fontSize: 13, lineHeight: 19 },
  restDayMsg: { color: C.dust, fontSize: 11, textAlign: 'center', letterSpacing: 0.5 },

  emptyDayCard: { backgroundColor: C.surface, borderRadius: 12, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  emptyDayText: { color: C.dust, fontSize: 12 },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  container: { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48, borderTopWidth: 1, borderColor: C.border },
  handle: { width: 36, height: 3, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  closeBtn: { position: 'absolute', top: 20, right: 24, width: 30, height: 30, borderRadius: 8, backgroundColor: C.surfaceAlt, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  title: { fontSize: 20, fontWeight: '800', color: C.chalk, marginBottom: 4, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: C.dust, marginBottom: 24 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { width: 32, height: 32, backgroundColor: C.surfaceAlt, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  monthTitle: { color: C.chalk, fontSize: 15, fontWeight: '700' },
  dayHeaders: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  dayHeader: { color: C.dust, fontSize: 10, fontWeight: '600', width: '14.28%', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  emptyCell: { width: '14.28%', aspectRatio: 1 },
  cell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 6, borderWidth: 1, borderColor: C.border, marginBottom: 4 },
  cellPast: { opacity: 0.2 },
  cellGoal: { backgroundColor: C.goalBg, borderColor: C.goal },
  cellText: { color: C.chalk, fontSize: 13, fontWeight: '500' },
  cellTextPast: { color: C.dust },
  cellTextGoal: { color: C.goal, fontWeight: '700' },
});