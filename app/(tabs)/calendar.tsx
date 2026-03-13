import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getCheckIns, getSessions } from '../../storage';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function getResColor(res) {
  if (!res && res !== 0) return null;
  if (res <= 40) return '#00b4d8';
  if (res <= 70) return '#f4a261';
  return '#e63946';
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
      getSessions(), getCheckIns(), AsyncStorage.getItem('goalDate'),
    ]);
    setSessions(sessionData);
    setCheckIns(checkInData);
    if (savedGoal) setGoalDate(savedGoal);
  };

  const saveGoalDate = async (dateStr) => {
    await AsyncStorage.setItem('goalDate', dateStr);
    setGoalDate(dateStr);
    setShowGoalModal(false);
  };

  const clearGoalDate = async () => {
    await AsyncStorage.removeItem('goalDate');
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
          <View>
            <Text style={styles.greeting}>Training Log</Text>
            <Text style={styles.title}>History</Text>
          </View>
          <View style={styles.headerStats}>
            <View style={styles.headerStat}>
              <Text style={styles.headerStatValue}>{totalSessions}</Text>
              <Text style={styles.headerStatLabel}>Total</Text>
            </View>
            <View style={styles.headerStatDivider} />
            <View style={styles.headerStat}>
              <Text style={[styles.headerStatValue, { color: '#e63946' }]}>{hardSessions}</Text>
              <Text style={styles.headerStatLabel}>Hard</Text>
            </View>
          </View>
        </View>

        {/* Goal Date Banner */}
        {goalDate ? (
          <View style={styles.goalBanner}>
            <View style={styles.goalBannerIcon}>
              <Ionicons name="flag-outline" size={20} color="#a855f7" />
            </View>
            <View style={styles.goalBannerContent}>
              <Text style={styles.goalBannerLabel}>Project Goal</Text>
              <Text style={styles.goalBannerDate}>{formatGoalDate(goalDate)}</Text>
              <Text style={styles.goalBannerCountdown}>
                {daysUntilGoal > 0 ? `${daysUntilGoal} days to go` :
                 daysUntilGoal === 0 ? '🎯 Goal date is today!' : 'Goal date has passed'}
              </Text>
            </View>
            <View style={styles.goalBannerActions}>
              <TouchableOpacity onPress={() => { setGoalPickerMonth(new Date()); setShowGoalModal(true); }} style={styles.goalActionBtn}>
                <Ionicons name="pencil-outline" size={14} color="#a855f7" />
              </TouchableOpacity>
              <TouchableOpacity onPress={clearGoalDate} style={styles.goalActionBtn}>
                <Ionicons name="close-outline" size={14} color="#555" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.setGoalBtn} onPress={() => { setGoalPickerMonth(new Date()); setShowGoalModal(true); }}>
            <Ionicons name="flag-outline" size={16} color="#a855f7" />
            <Text style={styles.setGoalBtnText}>Set Project Goal Date</Text>
          </TouchableOpacity>
        )}

        {/* Goal Date Picker Modal */}
        <Modal visible={showGoalModal} animationType="slide" transparent>
          <View style={modalStyles.overlay}>
            <View style={modalStyles.container}>
              <View style={modalStyles.handle} />
              <TouchableOpacity onPress={() => setShowGoalModal(false)} style={modalStyles.closeBtn}>
                <Ionicons name="close" size={20} color="#888" />
              </TouchableOpacity>
              <Text style={modalStyles.title}>Set Goal Date</Text>
              <Text style={modalStyles.subtitle}>When do you want to send your project?</Text>

              <View style={modalStyles.monthNav}>
                <TouchableOpacity onPress={() => setGoalPickerMonth(new Date(gpYear, gpMonth - 1, 1))} style={modalStyles.navBtn}>
                  <Ionicons name="chevron-back" size={18} color="#fff" />
                </TouchableOpacity>
                <Text style={modalStyles.monthTitle}>{MONTHS[gpMonth]} {gpYear}</Text>
                <TouchableOpacity onPress={() => setGoalPickerMonth(new Date(gpYear, gpMonth + 1, 1))} style={modalStyles.navBtn}>
                  <Ionicons name="chevron-forward" size={18} color="#fff" />
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
                      onPress={() => !isPast && saveGoalDate(dateStr)}
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
          {/* Month Nav */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={18} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Day Headers */}
          <View style={styles.dayHeaders}>
            {DAYS.map(day => <Text key={day} style={styles.dayHeader}>{day}</Text>)}
          </View>

          {/* Grid */}
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
              const dotColor = restDay ? '#4caf50' : session ? getResColor(session.res) : null;
              const hasActivity = restDay || !!session;

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.cell,
                    hasActivity && { backgroundColor: (dotColor || '#333') + '22', borderColor: (dotColor || '#333') + '55' },
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
                  {isGoalDay && !hasActivity && <View style={[styles.dot, { backgroundColor: '#a855f7' }]} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            {[
              { color: '#4caf50', label: 'Rest' },
              { color: '#00b4d8', label: 'Light' },
              { color: '#f4a261', label: 'Moderate' },
              { color: '#e63946', label: 'Hard' },
              { color: '#a855f7', label: 'Goal' },
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
            <Ionicons name="calendar-outline" size={40} color="#2a2a2e" />
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptyText}>Your training history will appear here after your first session.</Text>
          </View>
        )}

        {!selectedDate && (totalSessions > 0 || Object.keys(checkIns).length > 0) && (
          <Text style={styles.hintText}>Tap a highlighted day to view details</Text>
        )}

        {/* Selected Day Detail */}
        {selectedDate && (isRestDay || selectedSession) && (
          <View style={styles.detailCard}>
            {/* Detail Header */}
            <View style={styles.detailHeader}>
              <View>
                <Text style={styles.detailDate}>
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric'
                  })}
                </Text>
                {isRestDay && (
                  <View style={styles.restBadge}>
                    <Ionicons name="bed-outline" size={12} color="#4caf50" />
                    <Text style={styles.restBadgeText}>Rest Day</Text>
                  </View>
                )}
              </View>
              {selectedSession && (
                <View style={[styles.resCircle, { borderColor: getResColor(selectedSession.res) + '60' }]}>
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
                  <View style={[styles.intensityBadge, { backgroundColor: getResColor(selectedSession.res) + '22', borderColor: getResColor(selectedSession.res) + '44' }]}>
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
              </>
            )}

            {isRestDay && !selectedSession && (
              <Text style={styles.restDayMsg}>Recovery logged — no session this day.</Text>
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
  container: { flex: 1, backgroundColor: '#0d0d0f' },
  scrollContent: { padding: 20, paddingBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16, marginBottom: 24 },
  greeting: { fontSize: 13, color: '#555', fontWeight: '500', letterSpacing: 0.3, marginBottom: 4 },
  title: { fontSize: 30, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 },
  headerStats: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141416', borderRadius: 14, padding: 12, gap: 12, borderWidth: 1, borderColor: '#1e1e22' },
  headerStat: { alignItems: 'center' },
  headerStatValue: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  headerStatLabel: { color: '#444', fontSize: 10, fontWeight: '600' },
  headerStatDivider: { width: 1, height: 24, backgroundColor: '#1e1e22' },

  goalBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141416', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a1a3a', gap: 12 },
  goalBannerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1e0a2e', justifyContent: 'center', alignItems: 'center' },
  goalBannerContent: { flex: 1 },
  goalBannerLabel: { color: '#a855f7', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  goalBannerDate: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  goalBannerCountdown: { color: '#7c3aed', fontSize: 12, marginTop: 2 },
  goalBannerActions: { gap: 6 },
  goalActionBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#1e1e22', justifyContent: 'center', alignItems: 'center' },

  setGoalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#141416', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#2a1a3a' },
  setGoalBtnText: { color: '#a855f7', fontSize: 14, fontWeight: '600' },

  calendarCard: { backgroundColor: '#141416', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1e1e22' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { width: 34, height: 34, backgroundColor: '#1e1e22', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  monthTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  dayHeaders: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  dayHeader: { color: '#333', fontSize: 11, fontWeight: '600', width: '14.28%', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  emptyCell: { width: '14.28%', aspectRatio: 1 },
  cell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: 'transparent', marginBottom: 2 },
  cellSelected: { backgroundColor: '#2a2a2e', borderColor: '#ffffff44' },
  cellToday: { borderColor: '#00b4d8' },
  cellGoal: { backgroundColor: '#1a0a2a', borderColor: '#a855f760' },
  cellText: { color: '#888', fontSize: 12, fontWeight: '500' },
  cellTextToday: { color: '#00b4d8', fontWeight: '800' },
  cellTextGoal: { color: '#a855f7', fontWeight: '700' },
  cellTextSelected: { color: '#ffffff', fontWeight: '700' },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#1e1e22' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { color: '#444', fontSize: 10, fontWeight: '500' },

  emptyCard: { backgroundColor: '#141416', borderRadius: 20, padding: 40, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#1e1e22' },
  emptyTitle: { color: '#333', fontSize: 16, fontWeight: '700', marginTop: 8 },
  emptyText: { color: '#2a2a2e', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  hintText: { color: '#2a2a2e', textAlign: 'center', fontSize: 12, marginBottom: 8 },

  detailCard: { backgroundColor: '#141416', borderRadius: 20, padding: 20, marginBottom: 8, borderWidth: 1, borderColor: '#1e1e22' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  detailDate: { color: '#ffffff', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  restBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#0d2a0d', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#1a4a1a' },
  restBadgeText: { color: '#4caf50', fontSize: 11, fontWeight: '700' },
  resCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  resCircleScore: { fontSize: 16, fontWeight: '800', lineHeight: 18 },
  resCircleLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  detailIntensityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  intensityBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  intensityBadgeText: { fontSize: 12, fontWeight: '700' },
  detailAttempts: { color: '#444', fontSize: 13 },
  detailDivider: { height: 1, backgroundColor: '#1e1e22', marginBottom: 14 },
  detailSectionLabel: { color: '#444', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  gradeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#001a24', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#003d4d' },
  gradeChipGrade: { color: '#00b4d8', fontSize: 13, fontWeight: '700' },
  gradeChipCount: { color: '#004d66', fontSize: 12 },
  holdChip: { backgroundColor: '#1e1e22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  holdChipText: { color: '#666', fontSize: 13 },
  moveChip: { backgroundColor: '#1a1000', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#3a2800' },
  moveChipText: { color: '#f4a261', fontSize: 13 },
  restDayMsg: { color: '#2d6b2d', fontSize: 13, marginTop: 8 },

  emptyDayCard: { backgroundColor: '#141416', borderRadius: 14, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#1e1e22' },
  emptyDayText: { color: '#333', fontSize: 13 },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  container: { backgroundColor: '#141416', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  handle: { width: 36, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  closeBtn: { position: 'absolute', top: 20, right: 24, width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e1e22', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#555', marginBottom: 24 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { width: 34, height: 34, backgroundColor: '#1e1e22', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  monthTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  dayHeaders: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  dayHeader: { color: '#333', fontSize: 11, fontWeight: '600', width: '14.28%', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  emptyCell: { width: '14.28%', aspectRatio: 1 },
  cell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2e', marginBottom: 4 },
  cellPast: { opacity: 0.25 },
  cellGoal: { backgroundColor: '#1a0a2a', borderColor: '#a855f7' },
  cellText: { color: '#ffffff', fontSize: 13, fontWeight: '500' },
  cellTextPast: { color: '#444' },
  cellTextGoal: { color: '#a855f7', fontWeight: '700' },
});