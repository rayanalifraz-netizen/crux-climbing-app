import { router, useFocusEffect } from 'expo-router';
import { editStore } from '../../lib/editStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, Image, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import ShareCardModal from '../../components/ShareCardModal';
import { deleteGoalDate, getCheckIns, getGoalDate, getInjuryAlerts, getProfile, getSessions, saveGoalDate, type ClimbEntry } from '../../storage';
import { gradeColor, gradeColorBg, toDisplayGrade, useTheme } from '../../context/ThemeContext';
import { V_GRADES, computeCHI, computeProjectReadiness } from '../../lib/scoring';

const SCREEN_W = Dimensions.get('window').width;
const GCHART_W = SCREEN_W - 64;
const GCHART_H = 200;
const GP = { l: 40, r: 8, t: 10, b: 24 };
const GDW = GCHART_W - GP.l - GP.r;
const GDH = GCHART_H - GP.t - GP.b;
const MAX_IDX = V_GRADES.length - 1;

function GradeProgressChart({ sessions, gradeSystem, limit }: {
  sessions: Record<string, any>; gradeSystem: string; limit: number;
}) {
  const { C } = useTheme();

  const points = useMemo(() => {
    const sorted = Object.entries(sessions)
      .filter(([, s]) => s.gradeData && Object.keys(s.gradeData).length > 0)
      .sort(([a], [b]) => a.localeCompare(b));
    const slice = limit === 0 ? sorted : sorted.slice(-limit);
    return slice.map(([date, s]) => {
      const allGrades = Object.keys(s.gradeData).filter(g => V_GRADES.includes(g) && s.gradeData[g].attempts > 0);
      const sentGrades = allGrades.filter(g => s.gradeData[g].sends > 0);
      const useGrades = sentGrades.length > 0 ? sentGrades : allGrades;
      if (useGrades.length === 0) return null;
      const maxG = useGrades.reduce((best, g) =>
        V_GRADES.indexOf(g) > V_GRADES.indexOf(best) ? g : best, useGrades[0]);
      const d = new Date(date + 'T00:00:00');
      return {
        grade: maxG,
        idx: V_GRADES.indexOf(maxG),
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        isSend: sentGrades.includes(maxG),
      };
    }).filter(Boolean);
  }, [sessions, limit]);

  if (points.length < 2) return (
    <View style={{ padding: 24, alignItems: 'center' }}>
      <Text style={{ color: C.dust, fontSize: 12 }}>Log at least 2 sessions to see progress</Text>
    </View>
  );

  const n = points.length;
  const xFor = (i: number) => GP.l + (i / (n - 1)) * GDW;
  const yFor = (idx: number) => GP.t + (1 - idx / MAX_IDX) * GDH;

  const linePath = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.idx).toFixed(1)}`
  ).join(' ');

  const labelStep = n <= 10 ? 1 : Math.ceil(n / 6);

  // Y axis: show a grade label every 2 steps
  const yLabels = V_GRADES.map((g, i) => ({ g, i })).filter(({ i }) => i % 2 === 0 || i === MAX_IDX);

  return (
    <Svg width={GCHART_W} height={GCHART_H}>
      {/* Light horizontal grid lines */}
      {yLabels.map(({ i }) => (
        <Line key={i} x1={GP.l} y1={yFor(i)} x2={GP.l + GDW} y2={yFor(i)}
          stroke={C.borderLight} strokeWidth={0.75} />
      ))}

      {/* Single clean line */}
      <Path d={linePath} stroke={C.terra} strokeWidth={2.5} fill="none"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots — filled for sends, outlined for attempts only */}
      {points.map((p, i) => (
        <Circle key={i} cx={xFor(i)} cy={yFor(p.idx)} r={n > 20 ? 3 : 4}
          fill={p.isSend ? C.terra : 'transparent'} stroke={C.terra} strokeWidth={1.5} />
      ))}

      {/* Y grade labels */}
      {yLabels.map(({ g, i }) => (
        <SvgText key={g} x={GP.l - 4} y={yFor(i) + 3} fontSize={8} fill={C.dust} textAnchor="end">
          {toDisplayGrade(g, gradeSystem)}
        </SvgText>
      ))}

      {/* X month labels */}
      {points.map((p, i) => {
        if (i % labelStep !== 0 && i !== n - 1) return null;
        return (
          <SvgText key={i} x={xFor(i)} y={GCHART_H - 4} fontSize={8}
            fill={C.dust} textAnchor="middle">{p.month}</SvgText>
        );
      })}
    </Svg>
  );
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function Card({ label, labelColor, accentColor, bgColor, children, style }: {
  label?: string; labelColor?: string; accentColor?: string; bgColor?: string; children?: any; style?: any;
}) {
  const { C } = useTheme();
  const hasAccent = !!accentColor;
  return (
    <View style={[{
      backgroundColor: bgColor || C.surface,
      borderRadius: 20,
      marginHorizontal: 16,
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

function getResColor(C, res) {
  if (!res && res !== 0) return null;
  if (res <= 40) return C.terra;
  if (res <= 70) return C.amber;
  return C.red;
}

function getResBorder(C, res) {
  if (!res && res !== 0) return C.border;
  if (res <= 40) return C.terraBorder;
  if (res <= 70) return C.amberBorder;
  return C.redBorder;
}

function getResBg(C, res) {
  if (!res && res !== 0) return C.surface;
  if (res <= 40) return C.terraBg;
  if (res <= 70) return C.amberBg;
  return C.redBg;
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
  const { C, gradeSystem } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const modalStyles = useMemo(() => makeModalStyles(C), [C]);
  const [sessions, setSessions] = useState({});
  const [checkIns, setCheckIns] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [goalDate, setGoalDate] = useState(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalPickerMonth, setGoalPickerMonth] = useState(new Date());
  const [viewerUris, setViewerUris] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [showViewer, setShowViewer] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [projectReadiness, setProjectReadiness] = useState(null);
  const [showProjectedProgress, setShowProjectedProgress] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [progressLimit, setProgressLimit] = useState(30);

  useEffect(() => {
    AsyncStorage.getItem('showProjectedProgress').then(v => {
      if (v !== null) setShowProjectedProgress(v === 'true');
    }).catch(() => {});
  }, []);

  const toggleProjectedProgress = () => {
    setShowProjectedProgress(prev => {
      const next = !prev;
      AsyncStorage.setItem('showProjectedProgress', String(next)).catch(() => {});
      return next;
    });
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    const [sessionData, checkInData, savedGoal, profile, injuryAlerts] = await Promise.all([
      getSessions(), getCheckIns(), getGoalDate(), getProfile(), getInjuryAlerts(),
    ]);
    setSessions(sessionData);
    setCheckIns(checkInData);
    setProfile(profile);
    if (savedGoal) setGoalDate(savedGoal);

    if (profile?.projectGrade && profile?.maxGrade) {
      const chiData = computeCHI(sessionData, checkInData, injuryAlerts);
      let progressCount = 0;
      Object.values(sessionData).forEach((sess: any) => {
        progressCount += sess.gradeData?.[profile.projectGrade]?.sends ?? 0;
      });
      setProjectReadiness(computeProjectReadiness({
        chiData,
        sessions: sessionData,
        checkIns: checkInData,
        progressCount,
        progressMax: profile.sendsToUnlock ?? 10,
        projectGrade: profile.projectGrade,
        maxGrade: profile.maxGrade,
      }));
    } else {
      setProjectReadiness(null);
    }
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
          </View>
          <View style={styles.statsBox}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{totalSessions}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: C.red }]}>{hardSessions}</Text>
              <Text style={styles.statLabel}>Hard</Text>
            </View>
          </View>
        </View>

        {/* Goal Date */}
        {goalDate ? (
          <Card label="Project Goal" accentColor={C.goal} bgColor={C.goalBg} labelColor={C.goal}>
            <View style={styles.goalInner}>
              <View style={{ flex: 1 }}>
                <Text style={styles.goalDate}>{formatGoalDate(goalDate)}</Text>
                <Text style={styles.goalCountdown}>
                  {daysUntilGoal > 0 ? `${daysUntilGoal} days to go` :
                   daysUntilGoal === 0 ? 'Goal date is today' : 'Goal date has passed'}
                </Text>
              </View>
              <View style={styles.goalActions}>
                <TouchableOpacity
                  onPress={() => { setGoalPickerMonth(new Date()); setShowGoalModal(true); }}
                  style={[styles.goalBtn, { borderColor: C.goalBorder }]}
                >
                  <Text style={[styles.goalBtnText, { color: C.goal }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleClearGoalDate}
                  style={[styles.goalBtn, { borderColor: C.borderLight }]}
                >
                  <Text style={[styles.goalBtnText, { color: C.dust }]}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        ) : (
          <TouchableOpacity
            style={styles.setGoalBtn}
            onPress={() => { setGoalPickerMonth(new Date()); setShowGoalModal(true); }}
          >
            <Text style={styles.setGoalBtnText}>+ Set Project Goal Date</Text>
          </TouchableOpacity>
        )}

        {/* Projected Progress */}
        {projectReadiness && (() => {
          const pr = projectReadiness;
          const isReady = pr.primaryFactor === 'ready';
          const accentColor = isReady ? C.green : pr.primaryFactor === 'health' ? C.red : C.amber;
          const bgColor = showProjectedProgress ? (isReady ? C.greenBg : pr.primaryFactor === 'health' ? C.redBg : C.amberBg) : C.surface;
          const dateStr = pr.recommendedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          const healthBarW = `${Math.max(0, Math.min(100, 100 - pr.healthDays * 12))}%`;
          const progressBarW = `${Math.round(pr.progressRate * 100)}%`;
          return (
            <Card accentColor={showProjectedProgress ? accentColor : undefined} bgColor={bgColor}>
              {/* Header row with toggle */}
              <TouchableOpacity
                onPress={toggleProjectedProgress}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: showProjectedProgress ? 2 : 16 }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: showProjectedProgress ? accentColor : C.dust, letterSpacing: 1, textTransform: 'uppercase' }}>
                  Projected Progress
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: C.dust }}>{showProjectedProgress ? 'On' : 'Off'}</Text>
                  <View style={{ width: 36, height: 22, borderRadius: 11, backgroundColor: showProjectedProgress ? accentColor : C.borderLight, padding: 2, justifyContent: 'center' }}>
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: C.surface, transform: [{ translateX: showProjectedProgress ? 14 : 0 }] }} />
                  </View>
                </View>
              </TouchableOpacity>

              {showProjectedProgress && (
                <View style={{ paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: isReady ? 20 : 17, fontWeight: '800', color: accentColor, lineHeight: 22 }}>
                        {isReady ? 'Ready to send!' : dateStr}
                      </Text>
                      <Text style={{ fontSize: 12, color: accentColor + 'bb', marginTop: 3, lineHeight: 17 }}>
                        {pr.reason}
                      </Text>
                    </View>
                    {!isReady && (
                      <View style={{ alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: accentColor + '60', marginLeft: 12 }}>
                        <Text style={{ fontSize: 20, fontWeight: '900', color: accentColor, lineHeight: 24 }}>{pr.totalDays}</Text>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: accentColor, letterSpacing: 0.5 }}>DAYS</Text>
                      </View>
                    )}
                  </View>

                  <View style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: C.sand }}>Project sends</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: pr.progressRate >= 0.8 ? C.green : pr.progressRate >= 0.5 ? C.amber : C.red }}>
                        {Math.round(pr.progressRate * 100)}%
                      </Text>
                    </View>
                    <View style={{ height: 5, backgroundColor: C.borderLight, borderRadius: 3, overflow: 'hidden' }}>
                      <View style={{ height: 5, width: progressBarW, backgroundColor: pr.progressRate >= 0.8 ? C.green : pr.progressRate >= 0.5 ? C.amber : C.red, borderRadius: 3 }} />
                    </View>
                  </View>

                  <Text style={{ fontSize: 10, color: C.dust, fontStyle: 'italic', lineHeight: 15 }}>
                    Estimated suggestion based on your logged data. Individual results vary — listen to your body.
                  </Text>
                </View>
              )}
            </Card>
          );
        })()}

        {/* Goal Date Picker Modal */}
        <Modal visible={showGoalModal} animationType="slide" transparent>
          <View style={modalStyles.overlay}>
            <View style={modalStyles.container}>
              <View style={modalStyles.titleBar}>
                <Text style={modalStyles.titleBarText}>Set Goal Date</Text>
                <TouchableOpacity onPress={() => setShowGoalModal(false)} style={modalStyles.closeBtn}>
                  <Text style={modalStyles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={modalStyles.body}>
                <Text style={modalStyles.subtitle}>When do you want to send your project?</Text>
                <View style={modalStyles.monthNav}>
                  <TouchableOpacity onPress={() => setGoalPickerMonth(new Date(gpYear, gpMonth - 1, 1))} style={modalStyles.navBtn}>
                    <Text style={modalStyles.navBtnText}>‹</Text>
                  </TouchableOpacity>
                  <Text style={modalStyles.monthTitle}>{MONTHS[gpMonth]} {gpYear}</Text>
                  <TouchableOpacity onPress={() => setGoalPickerMonth(new Date(gpYear, gpMonth + 1, 1))} style={modalStyles.navBtn}>
                    <Text style={modalStyles.navBtnText}>›</Text>
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
          </View>
        </Modal>

        {/* Calendar */}
        <Card label={`${MONTHS[month]} ${year}`} style={{ marginTop: 4 }}>
          <View style={styles.calendarInner}>
            {/* Month Nav */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
                <Text style={styles.navBtnText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthTitle}>{MONTHS[month]} {year}</Text>
              <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
                <Text style={styles.navBtnText}>›</Text>
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
                const dotColor = restDay ? C.green : session ? getResColor(C, session.res) : checkIn ? C.dust : null;
                const hasActivity = restDay || !!session || !!checkIn;

                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[
                      styles.cell,
                      hasActivity && { backgroundColor: (dotColor || C.dust) + '22', borderColor: (dotColor || C.dust) + '66' },
                      isSelected && { backgroundColor: C.ink + '12', borderColor: C.ink },
                      isToday && !isSelected && { borderColor: C.terraBorder },
                      isGoalDay && { backgroundColor: C.goalBg, borderColor: C.goalBorder },
                    ]}
                    onPress={() => setSelectedDate(isSelected ? null : dateStr)}
                  >
                    <Text style={[
                      styles.cellText,
                      isToday && { color: C.terra, fontWeight: '800' },
                      isGoalDay && { color: C.goal, fontWeight: '800' },
                      isSelected && { color: C.ink, fontWeight: '800' },
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
        </Card>

        {/* Grade Progress Chart */}
        {Object.keys(sessions).filter(d => sessions[d].gradeData && Object.keys(sessions[d].gradeData).length > 0).length >= 2 && (
          <Card label="Grade Progress">
            <View style={styles.progressInner}>
              <View style={styles.progressTopRow}>
                <Text style={styles.progressSubtitle}>Max grade climbed each session</Text>
                <View style={styles.progressBtns}>
                  {[{ label: '30', val: 30 }, { label: 'All', val: 0 }].map(opt => (
                    <TouchableOpacity
                      key={opt.val}
                      style={[styles.progressBtn, progressLimit === opt.val && styles.progressBtnActive]}
                      onPress={() => setProgressLimit(opt.val)}
                    >
                      <Text style={[styles.progressBtnText, progressLimit === opt.val && styles.progressBtnTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <GradeProgressChart
                sessions={sessions}
                gradeSystem={gradeSystem}
                limit={progressLimit}
              />
            </View>
          </Card>
        )}

        {/* Empty / Hint */}
        {!selectedDate && totalSessions === 0 && Object.keys(checkIns).length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptyText}>Your training history will appear here after your first session.</Text>
          </View>
        )}
        {!selectedDate && (totalSessions > 0 || Object.keys(checkIns).length > 0) && (
          <Text style={styles.hintText}>Tap a highlighted day to view details</Text>
        )}

        {/* Detail Window */}
        {selectedDate && (isRestDay || selectedSession) && (
          <Card
            label={new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            accentColor={selectedSession ? getResColor(C, selectedSession.res) : C.green}
            bgColor={selectedSession ? getResBg(C, selectedSession.res) : C.greenBg}
            labelColor={selectedSession ? getResColor(C, selectedSession.res) : C.green}
            style={{ marginTop: 4 }}
          >
            <View style={styles.detailInner}>
              {/* Share button */}
              {selectedSession && (
                <TouchableOpacity
                  style={[styles.shareCardBtn, { borderColor: getResBorder(C, selectedSession.res) }]}
                  onPress={() => setShowShareCard(true)}
                >
                  <Text style={[styles.shareCardBtnText, { color: getResColor(C, selectedSession.res) }]}>↑ Share Session</Text>
                </TouchableOpacity>
              )}

              {/* Rest Day Badge */}
              {isRestDay && (
                <View style={[styles.restBadge, { borderColor: C.greenBorder }]}>
                  <Text style={styles.restBadgeText}>Rest Day</Text>
                </View>
              )}

              {selectedSession && (
                <>
                  {/* RES + intensity row */}
                  <View style={styles.detailTopRow}>
                    <View style={[styles.intensityTag, {
                      borderColor: getResBorder(C, selectedSession.res),
                      backgroundColor: getResBg(C, selectedSession.res),
                    }]}>
                      <Text style={[styles.intensityTagText, { color: getResColor(C, selectedSession.res) }]}>
                        {getResLabel(selectedSession.res)} Session
                      </Text>
                    </View>
                    <View style={styles.detailRight}>
                      <View style={[styles.resScoreBox, { borderColor: getResBorder(C, selectedSession.res) }]}>
                        <Text style={[styles.resScoreNum, { color: getResColor(C, selectedSession.res) }]}>
                          {selectedSession.res}
                        </Text>
                        <Text style={[styles.resScoreLabel, { color: getResColor(C, selectedSession.res) }]}>RES</Text>
                      </View>
                      <Text style={styles.detailAttempts}>
                        {(selectedSession.climbs || Object.entries(selectedSession.gradeData || {}).map(([g, e]) => ({ attempts: e.attempts, sends: e.sends }))).reduce((a, e) => a + e.attempts, 0)} att · {(selectedSession.climbs || Object.entries(selectedSession.gradeData || {}).map(([g, e]) => ({ attempts: e.attempts, sends: e.sends }))).reduce((a, e) => a + e.sends, 0)} sends
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailRule} />

                  {/* Grades */}
                  <Text style={styles.detailSectionLabel}>Grades</Text>
                  <View style={styles.climbEntryList}>
                    {(selectedSession.climbs ||
                      Object.entries(selectedSession.gradeData || {})
                        .filter(([, e]) => e.attempts > 0)
                        .map(([grade, e]) => ({ id: grade, grade, attempts: e.attempts, sends: e.sends }))
                    ).map((c: ClimbEntry) => {
                      const color = gradeColor(c.grade);
                      let label: string;
                      if (c.attempts === 1 && c.sends === 1) label = `${toDisplayGrade(c.grade, gradeSystem)} · Flash`;
                      else if (c.sends >= 1) label = `${toDisplayGrade(c.grade, gradeSystem)} · ${c.attempts} att · Sent ✓`;
                      else label = `${toDisplayGrade(c.grade, gradeSystem)} · ${c.attempts} att`;
                      return (
                        <View key={c.id} style={[styles.climbEntryRow, { borderLeftColor: color }]}>
                          <Text style={[styles.climbEntryText, { color }]}>{label}</Text>
                        </View>
                      );
                    })}
                  </View>

                  {selectedSession.holdTypes?.length > 0 && (
                    <>
                      <Text style={styles.detailSectionLabel}>Holds</Text>
                      <View style={styles.chipRow}>
                        {selectedSession.holdTypes.map(h => (
                          <View key={h} style={[styles.chip, { borderColor: C.borderLight }]}>
                            <Text style={[styles.chipGrade, { color: C.sand }]}>{h}</Text>
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
                          <View key={m} style={[styles.chip, { borderColor: C.amberBorder, backgroundColor: C.amberBg }]}>
                            <Text style={[styles.chipGrade, { color: C.amber }]}>{m}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}

                  {selectedSession.notes ? (
                    <>
                      <Text style={styles.detailSectionLabel}>Notes</Text>
                      <Text style={styles.notesText}>{selectedSession.notes}</Text>
                    </>
                  ) : null}

                  {selectedSession.mediaUris?.length > 0 && (
                    <>
                      <Text style={styles.detailSectionLabel}>Media</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
                          {selectedSession.mediaUris.map((uri, idx) => (
                            <TouchableOpacity
                              key={uri}
                              onPress={() => { setViewerUris(selectedSession.mediaUris); setViewerIndex(idx); setShowViewer(true); }}
                            >
                              <Image source={{ uri }} style={styles.mediaThumbnail} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </>
                  )}
                </>
              )}

              {isRestDay && !selectedSession && (
                <>
                  <Text style={styles.restMsg}>Recovery logged — no session this day.</Text>
                  {selectedCheckIn?.notes ? (
                    <>
                      <Text style={[styles.detailSectionLabel, { marginTop: 12 }]}>Notes</Text>
                      <Text style={styles.notesText}>{selectedCheckIn.notes}</Text>
                    </>
                  ) : null}
                </>
              )}
            </View>
          </Card>
        )}

        {/* Check-in Summary */}
        {selectedDate && selectedCheckIn && !isRestDay && (
          <Card label="Check-in" accentColor={C.green} bgColor={C.greenBg} labelColor={C.green} style={{ marginTop: 4 }}>
            <View style={styles.detailInner}>
              <Text style={styles.detailSectionLabel}>Soreness</Text>
              <Text style={{ color: C.green, fontSize: 22, fontWeight: '800', marginBottom: 14 }}>{selectedCheckIn.soreness}/10</Text>
              {selectedCheckIn.painAreas?.length > 0 && (
                <>
                  <Text style={styles.detailSectionLabel}>Pain Areas</Text>
                  <View style={styles.chipRow}>
                    {selectedCheckIn.painAreas.map(area => (
                      <View key={area} style={[styles.chip, { borderColor: C.redBorder, backgroundColor: C.redBg }]}>
                        <Text style={[styles.chipGrade, { color: C.red }]}>{area}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
              {selectedCheckIn.affectedFingers?.length > 0 && (
                <>
                  <Text style={styles.detailSectionLabel}>Affected Fingers</Text>
                  <View style={styles.chipRow}>
                    {selectedCheckIn.affectedFingers.map(f => (
                      <View key={f} style={[styles.chip, { borderColor: C.amberBorder, backgroundColor: C.amberBg }]}>
                        <Text style={[styles.chipGrade, { color: C.amber }]}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
              {selectedCheckIn.notes ? (
                <>
                  <Text style={styles.detailSectionLabel}>Notes</Text>
                  <Text style={styles.notesText}>{selectedCheckIn.notes}</Text>
                </>
              ) : null}
            </View>
          </Card>
        )}

        {/* Check-in Photos */}
        {selectedDate && selectedCheckIn && !selectedCheckIn.isRestDay && (selectedCheckIn.mediaUris?.length ?? 0) > 0 && (
          <Card label="Check-in Photos" accentColor={C.green} bgColor={C.greenBg} labelColor={C.green} style={{ marginTop: 0 }}>
            <View style={styles.detailInner}>
              <Text style={styles.detailSectionLabel}>Skin &amp; Injury Photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
                  {selectedCheckIn.mediaUris!.map((uri, idx) => (
                    <TouchableOpacity
                      key={uri}
                      onPress={() => { setViewerUris(selectedCheckIn.mediaUris!); setViewerIndex(idx); setShowViewer(true); }}
                    >
                      <Image source={{ uri }} style={styles.mediaThumbnail} />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </Card>
        )}

        {/* Edit buttons row — only for today and past dates */}
        {selectedDate && selectedDate <= todayStr && (
          <View style={styles.editBtnRow}>
            <TouchableOpacity
              style={[styles.editBtnStandalone, { borderColor: C.terraBorder, flex: 1 }]}
              onPress={() => { editStore.sessionDate = selectedDate; router.navigate('/(tabs)/session'); }}
            >
              <Text style={[styles.editBtnText, { color: C.terra }]}>
                {selectedSession ? 'Edit Session →' : '+ Log Session'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editBtnStandalone, { borderColor: C.greenBorder, flex: 1 }]}
              onPress={() => { editStore.checkinDate = selectedDate; router.navigate('/(tabs)/checkin'); }}
            >
              <Text style={[styles.editBtnText, { color: C.green }]}>
                {selectedCheckIn ? 'Edit Check-in →' : '+ Log Check-in'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedDate && !isRestDay && !selectedSession && !(selectedCheckIn?.mediaUris?.length) && (
          <Card style={{ marginTop: 4 }}>
            <View style={styles.emptyDayInner}>
              <Text style={styles.emptyDayText}>No activity logged for this day</Text>
            </View>
          </Card>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Session share card */}
      {selectedSession && selectedDate && (
        <ShareCardModal
          visible={showShareCard}
          onClose={() => setShowShareCard(false)}
          type="session"
          session={selectedSession}
          date={selectedDate}
        />
      )}

      {/* Full-screen media viewer */}
      <Modal visible={showViewer} transparent animationType="fade" onRequestClose={() => setShowViewer(false)}>
        <View style={styles.viewerOverlay}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setShowViewer(false)}>
            <Text style={styles.viewerCloseText}>✕</Text>
          </TouchableOpacity>
          {viewerUris.length > 0 && (
            <Image
              source={{ uri: viewerUris[viewerIndex] }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          )}
          {viewerUris.length > 1 && (
            <View style={styles.viewerNav}>
              <TouchableOpacity
                style={[styles.viewerNavBtn, viewerIndex === 0 && { opacity: 0.3 }]}
                onPress={() => setViewerIndex(i => Math.max(0, i - 1))}
                disabled={viewerIndex === 0}
              >
                <Text style={styles.viewerNavText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.viewerCounter}>{viewerIndex + 1} / {viewerUris.length}</Text>
              <TouchableOpacity
                style={[styles.viewerNavBtn, viewerIndex === viewerUris.length - 1 && { opacity: 0.3 }]}
                onPress={() => setViewerIndex(i => Math.min(viewerUris.length - 1, i + 1))}
                disabled={viewerIndex === viewerUris.length - 1}
              >
                <Text style={styles.viewerNavText}>›</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    scrollContent: { paddingBottom: 110 },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 28, paddingBottom: 16 },
    greeting: { fontSize: 11, color: C.dust, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
    title: { fontSize: 38, fontWeight: '800', color: C.ink, letterSpacing: -1.5, lineHeight: 42 },
    statsBox: {
      flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12,
      backgroundColor: C.surface, marginTop: 6, borderRadius: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    statItem: { alignItems: 'center' },
    statNum: { color: C.ink, fontSize: 18, fontWeight: '800' },
    statLabel: { color: C.dust, fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 },
    statDivider: { width: 1, height: 24, backgroundColor: C.borderLight },

    goalInner: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingLeft: 24, paddingTop: 14, gap: 12 },
    goalDate: { color: C.ink, fontSize: 14, fontWeight: '800', marginBottom: 3 },
    goalCountdown: { color: C.goal, fontSize: 11, fontWeight: '600' },
    goalActions: { gap: 6 },
    goalBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
    goalBtnText: { fontSize: 11, fontWeight: '800' },

    setGoalBtn: { marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderColor: C.goalBorder, borderRadius: 20, padding: 12, alignItems: 'center', backgroundColor: C.goalBg },
    setGoalBtnText: { color: C.goal, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

    calendarInner: { padding: 16, paddingTop: 14 },
    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    navBtn: { width: 30, height: 30, borderWidth: 1, borderColor: C.borderLight, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: C.surfaceAlt },
    navBtnText: { color: C.ink, fontSize: 18, fontWeight: '800', lineHeight: 22 },
    monthTitle: { color: C.ink, fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
    dayHeaders: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    dayHeader: { color: C.dust, fontSize: 9, fontWeight: '800', width: '14.28%', textAlign: 'center', letterSpacing: 0.5, textTransform: 'uppercase' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    emptyCell: { width: '14.28%', aspectRatio: 1 },
    cell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: 'transparent', marginBottom: 2 },
    cellText: { color: C.dust, fontSize: 12, fontWeight: '600' },
    dot: { width: 3, height: 3, borderRadius: 1.5, marginTop: 1 },
    legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.borderLight },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 5, height: 5, borderRadius: 1 },
    legendText: { color: C.dust, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

    progressInner: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10 },
    progressTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    progressSubtitle: { flex: 1, fontSize: 11, color: C.dust },
    progressBtns: { flexDirection: 'row', gap: 5 },
    progressBtn: { borderWidth: 1, borderColor: C.borderLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: C.surfaceAlt },
    progressBtnActive: { borderColor: C.terraBorder, backgroundColor: C.terraBg },
    progressBtnText: { fontSize: 10, fontWeight: '800', color: C.dust },
    progressBtnTextActive: { color: C.terra },

    emptyState: { marginHorizontal: 16, padding: 32, alignItems: 'center', gap: 6 },
    emptyTitle: { color: C.sand, fontSize: 14, fontWeight: '800' },
    emptyText: { color: C.dust, fontSize: 12, textAlign: 'center', lineHeight: 18 },
    hintText: { color: C.dust, textAlign: 'center', fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },

    detailInner: { padding: 18, paddingLeft: 24 },
    detailTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
    intensityTag: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
    intensityTagText: { fontSize: 11, fontWeight: '800' },
    detailRight: { alignItems: 'flex-end', gap: 4 },
    resScoreBox: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
    resScoreNum: { fontSize: 18, fontWeight: '800', lineHeight: 20 },
    resScoreLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
    detailAttempts: { color: C.dust, fontSize: 11 },
    detailRule: { height: 1, backgroundColor: C.borderLight, marginBottom: 12 },
    detailSectionLabel: { fontSize: 10, fontWeight: '700', color: C.dust, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 12 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
    chipGrade: { fontSize: 12, fontWeight: '800' },
    chipCount: { fontSize: 11 },
    climbEntryList: { gap: 7, marginBottom: 12 },
    climbEntryRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceAlt, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderLeftWidth: 3 },
    climbEntryText: { fontSize: 13, fontWeight: '700' },
    notesText: { color: C.sand, fontSize: 12, lineHeight: 18, marginBottom: 8 },
    restBadge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', marginBottom: 12 },
    restBadgeText: { color: C.green, fontSize: 11, fontWeight: '800' },
    restMsg: { color: C.sand, fontSize: 12 },
    editBtnRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 10 },
    editBtnStandalone: { marginTop: 0, padding: 14, borderWidth: 1, borderRadius: 16, alignItems: 'center' },
    editBtnText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },

    emptyDayInner: { padding: 20, alignItems: 'center' },
    emptyDayText: { color: C.dust, fontSize: 12, fontWeight: '600' },

    shareCardBtn: { alignSelf: 'flex-end', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12 },
    shareCardBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

    mediaThumbnail: { width: 88, height: 88, borderRadius: 10, backgroundColor: C.borderLight },

    viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
    viewerClose: { position: 'absolute', top: 52, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    viewerCloseText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    viewerImage: { width: '100%', height: '75%' },
    viewerNav: { flexDirection: 'row', alignItems: 'center', gap: 24, marginTop: 20 },
    viewerNavBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    viewerNavText: { color: '#fff', fontSize: 32, fontWeight: '300' },
    viewerCounter: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  });
}

function makeModalStyles(C) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(26,21,16,0.5)', justifyContent: 'flex-end' },
    container: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
    titleBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.ink, paddingHorizontal: 16, paddingVertical: 14 },
    titleBarText: { fontSize: 13, fontWeight: '800', color: C.surface, letterSpacing: 0.5 },
    closeBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center' },
    closeBtnText: { fontSize: 12, fontWeight: '800', color: C.ink },
    body: { padding: 20, paddingBottom: 48 },
    subtitle: { fontSize: 12, color: C.dust, marginBottom: 20 },
    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    navBtn: { width: 30, height: 30, borderWidth: 1, borderColor: C.borderLight, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    navBtnText: { color: C.ink, fontSize: 18, fontWeight: '800', lineHeight: 22 },
    monthTitle: { color: C.ink, fontSize: 14, fontWeight: '800' },
    dayHeaders: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    dayHeader: { color: C.dust, fontSize: 9, fontWeight: '700', width: '14.28%', textAlign: 'center', textTransform: 'uppercase' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    emptyCell: { width: '14.28%', aspectRatio: 1 },
    cell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: C.borderLight, marginBottom: 4 },
    cellPast: { opacity: 0.25 },
    cellGoal: { backgroundColor: C.goalBg, borderColor: C.goalBorder },
    cellText: { color: C.ink, fontSize: 13, fontWeight: '600' },
    cellTextPast: { color: C.dust },
    cellTextGoal: { color: C.goal, fontWeight: '800' },
  });
}
