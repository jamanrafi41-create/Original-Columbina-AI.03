/**
 * Factual Accuracy & Anti-Hallucination Verification Engine
 *
 * Provides real-time temporal ground truth, deterministic calendar calculations,
 * exact mathematical arithmetic evaluation, and factual validation context
 * to prevent hallucination in conversational responses.
 */

export interface FactualContext {
  currentTimestampIso: string;
  currentDateFormatted: string;
  currentDayOfWeek: string;
  currentTimeFormatted: string;
  currentYear: number;
  currentMonth: number;
  currentDay: number;
  computedInsights?: string[];
}

export class FactualEngine {
  /**
   * Generates comprehensive current temporal anchor data.
   */
  public static getCurrentTemporalContext(clientTimezone?: string): FactualContext {
    const now = new Date();
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    const currentDayOfWeek = daysOfWeek[now.getUTCDay()];
    const currentMonthName = months[now.getUTCMonth()];
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;
    const currentDay = now.getUTCDate();

    const formattedDate = `${currentDayOfWeek}, ${currentMonthName} ${currentDay}, ${currentYear}`;
    const formattedTime = now.toTimeString().split(' ')[0] || `${now.getUTCHours()}:${now.getUTCMinutes()}:${now.getUTCSeconds()} UTC`;

    return {
      currentTimestampIso: now.toISOString(),
      currentDateFormatted: formattedDate,
      currentDayOfWeek,
      currentTimeFormatted: formattedTime,
      currentYear,
      currentMonth,
      currentDay,
    };
  }

  /**
   * Evaluates user queries for deterministic mathematical or calendar calculations
   * and produces verified factual annotations to prevent AI hallucination.
   */
  public static verifyCalculationsAndDates(query: string, temporalContext: FactualContext): string[] {
    const insights: string[] = [];
    if (!query || typeof query !== 'string') return insights;

    const q = query.trim().toLowerCase();

    // 1. Current Date/Time Inquiries
    if (
      q.includes('what date is today') ||
      q.includes('what is today') ||
      q.includes("today's date") ||
      q.includes('todays date') ||
      q.includes('current date') ||
      q.includes('what is the date') ||
      q.includes('what day is today')
    ) {
      insights.push(`VERIFIED TODAY'S DATE: ${temporalContext.currentDateFormatted} (Year: ${temporalContext.currentYear}, Month: ${temporalContext.currentMonth}, Day: ${temporalContext.currentDay}, Day of Week: ${temporalContext.currentDayOfWeek})`);
    }

    // 2. Day of Week for Specific Dates (e.g., "What day is January 1, 2030?" or "What day was July 4, 1776?")
    const dayOfWeekMatch = query.match(
      /(?:what\s+day\s+(?:of\s+the\s+week\s+)?(?:is|was|will\s+be|on)\s+)?([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s*(\d{1,4})/i
    );
    if (dayOfWeekMatch) {
      const monthStr = dayOfWeekMatch[1];
      const dayNum = parseInt(dayOfWeekMatch[2], 10);
      const yearNum = parseInt(dayOfWeekMatch[3], 10);
      const parsedDate = new Date(`${monthStr} ${dayNum}, ${yearNum} 12:00:00 UTC`);
      if (!isNaN(parsedDate.getTime())) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = days[parsedDate.getUTCDay()];
        insights.push(
          `CALCULATED CALENDAR DAY: ${monthStr} ${dayNum}, ${yearNum} is/was a ${dayOfWeek}.`
        );
      }
    }

    // 3. Days Between Two Explicit Dates (e.g., "How many days between March 1, 2026 and June 1, 2026?")
    const betweenMatch = query.match(
      /how\s+many\s+days\s+between\s+([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(\d{4}))?\s+and\s+([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(\d{4}))?/i
    );
    if (betweenMatch) {
      const m1 = betweenMatch[1];
      const d1 = parseInt(betweenMatch[2], 10);
      const y1 = betweenMatch[3] ? parseInt(betweenMatch[3], 10) : temporalContext.currentYear;
      const m2 = betweenMatch[4];
      const d2 = parseInt(betweenMatch[5], 10);
      const y2 = betweenMatch[6] ? parseInt(betweenMatch[6], 10) : y1;

      const date1 = new Date(`${m1} ${d1}, ${y1} 00:00:00 UTC`);
      const date2 = new Date(`${m2} ${d2}, ${y2} 00:00:00 UTC`);
      if (!isNaN(date1.getTime()) && !isNaN(date2.getTime())) {
        const diffDays = Math.abs(Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24)));
        insights.push(
          `CALCULATED DATE INTERVAL: Between ${m1} ${d1}, ${y1} and ${m2} ${d2}, ${y2} is exactly ${diffDays} day(s).`
        );
      }
    }

    // 4. Days Until or Left Until (e.g. "How many days until December 25, 2026?")
    const untilMatch = query.match(
      /how\s+many\s+days\s+(?:until|left\s+until|until\s+my|to)\s+([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(\d{4}))?/i
    );
    if (untilMatch) {
      const targetMonth = untilMatch[1];
      const targetDay = parseInt(untilMatch[2], 10);
      const targetYear = untilMatch[3] ? parseInt(untilMatch[3], 10) : temporalContext.currentYear;
      const targetDate = new Date(`${targetMonth} ${targetDay}, ${targetYear} 00:00:00 UTC`);
      const currentDate = new Date(Date.UTC(temporalContext.currentYear, temporalContext.currentMonth - 1, temporalContext.currentDay));
      if (!isNaN(targetDate.getTime())) {
        let diffMs = targetDate.getTime() - currentDate.getTime();
        let diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays < 0 && !untilMatch[3]) {
          // If past this year and year was not specified, compute for next year
          const nextYearDate = new Date(`${targetMonth} ${targetDay}, ${targetYear + 1} 00:00:00 UTC`);
          diffMs = nextYearDate.getTime() - currentDate.getTime();
          diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        }
        insights.push(
          `CALCULATED DATE INTERVAL: From today (${temporalContext.currentDateFormatted}) to ${targetMonth} ${targetDay}, ${targetYear} is ${diffDays} day(s).`
        );
      }
    }

    // 4. Arithmetic Calculations (Safe evaluator for basic math expressions)
    // Matches e.g. "27 * 48", "27 x 48", "125 + 450", "15% of 800", "500 / 4"
    const percentMatch = query.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/i);
    if (percentMatch) {
      const p = parseFloat(percentMatch[1]);
      const total = parseFloat(percentMatch[2]);
      const res = (p / 100) * total;
      insights.push(`CALCULATED PERCENTAGE: ${p}% of ${total} = ${res}`);
    }

    const mathMatch = query.match(
      /(?:what\s+is|calculate|compute)?\s*(-?\d+(?:\.\d+)?)\s*([\+\-\*\/×÷])\s*(-?\d+(?:\.\d+)?)(?:\s*([\+\-\*\/×÷])\s*(-?\d+(?:\.\d+)?))?/i
    );
    if (mathMatch && !query.includes('date') && !query.includes('year') && !query.includes('day')) {
      try {
        const num1 = parseFloat(mathMatch[1]);
        const op1 = mathMatch[2] === '×' ? '*' : mathMatch[2] === '÷' ? '/' : mathMatch[2];
        const num2 = parseFloat(mathMatch[3]);

        if (!isNaN(num1) && !isNaN(num2)) {
          let calcResult: number | null = null;
          if (op1 === '+') calcResult = num1 + num2;
          else if (op1 === '-') calcResult = num1 - num2;
          else if (op1 === '*') calcResult = num1 * num2;
          else if (op1 === '/' && num2 !== 0) calcResult = num1 / num2;

          if (calcResult !== null && mathMatch[4] && mathMatch[5]) {
            const op2 = mathMatch[4] === '×' ? '*' : mathMatch[4] === '÷' ? '/' : mathMatch[4];
            const num3 = parseFloat(mathMatch[5]);
            if (!isNaN(num3)) {
              if (op2 === '+') calcResult = calcResult + num3;
              else if (op2 === '-') calcResult = calcResult - num3;
              else if (op2 === '*') calcResult = calcResult * num3;
              else if (op2 === '/' && num3 !== 0) calcResult = calcResult / num3;
            }
          }

          if (calcResult !== null) {
            insights.push(`CALCULATED ARITHMETIC RESULT: ${query.trim()} = ${calcResult}`);
          }
        }
      } catch {
        // Fall back gracefully
      }
    }

    return insights;
  }
}
