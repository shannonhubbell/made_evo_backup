<template>
  <div class="w-full">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <!-- Flex container for calendar and events side-by-side -->
      <div class="flex flex-col lg:flex-row lg:items-stretch">
        <!-- Calendar Section -->
        <div class="flex-1 lg:border-r lg:border-gray-200 lg:dark:border-gray-700 flex flex-col">
          <!-- Calendar Header -->
          <div class="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <div class="flex items-center justify-between">
              <div>
                <h2 id="calendar-month-year" class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ monthNames[currentMonth] }} {{ currentYear }}
                </h2>
              </div>
              <div v-if="showNavigation" class="flex items-center gap-2">
                <button 
                  type="button"
                  @click="navigateMonth(-1)"
                  class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                  aria-label="Previous month"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button 
                  type="button"
                  @click="navigateMonth(1)"
                  class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                  aria-label="Next month"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Calendar Grid -->
          <div class="p-6">
            <!-- Day Names Header -->
            <div class="grid grid-cols-7 gap-2 mb-4">
              <div 
                v-for="dayName in dayNames" 
                :key="dayName"
                class="text-center text-sm font-semibold text-gray-600 dark:text-gray-400 py-2"
              >
                {{ dayName }}
              </div>
            </div>

            <!-- Calendar Days -->
            <div class="grid grid-cols-7 gap-2">
              <div
                v-for="(day, index) in calendarDays"
                :key="index"
                :class="[
                  'aspect-square p-2 rounded-lg border border-gray-200 dark:border-gray-700',
                  day.day === null 
                    ? 'bg-gray-50 dark:bg-gray-900/50' 
                    : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                  isToday(day) ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
                ]"
              >
                <template v-if="day.day !== null">
                  <div :class="[
                    'text-sm font-medium mb-1',
                    isToday(day)
                      ? 'text-blue-600 dark:text-blue-400' 
                      : (day.isPrevMonth || day.isNextMonth)
                        ? 'text-gray-400 dark:text-gray-600'
                        : 'text-gray-900 dark:text-gray-100'
                  ]">
                    {{ day.day }}
                  </div>
                  <div v-if="getEventsForDay(day).length > 0" class="space-y-1">
                    <a :href="getEventUrl(event.slug)"
                      v-for="(event, eventIndex) in getEventsForDay(day).slice(0, 2)"
                      :key="eventIndex"
                      :class="[
                        'text-xs px-1.5 py-0.5 rounded truncate block',
                        (day.isPrevMonth || day.isNextMonth)
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500'
                          : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                      ]"
                      :title="event.title"
                    >
                      {{ event.title }}
                  </a>
                    <div 
                      v-if="getEventsForDay(day).length > 2"
                      class="text-xs text-gray-500 dark:text-gray-400 px-1"
                    >
                      +{{ getEventsForDay(day).length - 2 }} more
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- Events List Section (Right side on desktop, below on mobile) -->
        <div v-if="upcomingEvents.length > 0" class="lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900 lg:flex lg:flex-col lg:overflow-y-auto">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Upcoming Events</h3>
          <div class="space-y-2">
            <div 
              v-for="(event, index) in upcomingEvents.slice(0, 5)"
              :key="index"
              class="flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div class="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <span class="text-sm font-semibold text-blue-800 dark:text-blue-200">
                  {{ new Date(event.startDate).getDate() }}
                </span>
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ event.title }}
                </h4>
                <p v-if="event.description" class="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                  {{ event.description }}
                </p>
                <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {{ formatEventDate(event.startDate) }}
                </p>
              </div>
              <a 
                :href="getEventUrl(event.slug)"
                class="flex-shrink-0 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                :aria-label="`View ${event.title}`"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { prependBase, EVENT_TIME_ZONE, getEventDateParts } from '../../../lib/helpers';

interface Event {
  sys: { id: string };
  name: string;
  title: string;
  startDate: string;
  endDate?: string;
  slug: string;
  description?: string | null;
}

interface CalendarDay {
  day: number | null;
  isPrevMonth?: boolean;
  isNextMonth?: boolean;
}

const props = withDefaults(defineProps<{
  initialDate?: Date;
  showNavigation?: boolean;
  locale?: string;
}>(), {
  initialDate: () => new Date(),
  showNavigation: true,
  locale: 'en-US'
});

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Use MADE's venue timezone (Pacific) rather than the browser/server's local timezone,
// so the default displayed month is consistent everywhere.
const initialDateParts = getEventDateParts(props.initialDate);
const currentYear = ref(initialDateParts.year);
const currentMonth = ref(initialDateParts.month);

const allEvents = ref<Event[]>([]);
const upcomingEvents = ref<Event[]>([]);
const loading = ref(false);
let checkInterval: ReturnType<typeof setInterval> | null = null;

// In-memory cache of by_month blobs already fetched this page load, keyed by "YYYY-MM".
// The blobs themselves are static (regenerated only by a Contentful/Eventbrite webhook
// rebuild), so within a single page load there's never a reason to re-fetch a month.
const monthCache = new Map<string, Event[]>();

// Guards against out-of-order responses when a visitor navigates months faster than
// the fetches resolve (e.g. double-clicking "next") - only the latest request's
// result is applied to the grid.
let loadToken = 0;

const calendarDays = computed(() => {
  const firstDay = new Date(currentYear.value, currentMonth.value, 1);
  const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();
  const prevMonthLastDay = new Date(currentYear.value, currentMonth.value, 0).getDate();

  const days: CalendarDay[] = [];

  // Add previous month's days at the start
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    days.push({ day: prevMonthLastDay - i, isPrevMonth: true });
  }

  // Add current month's days
  for (let day = 1; day <= daysInMonth; day++) {
    days.push({ day });
  }

  // Fill remaining cells to make 42 total (6 rows)
  const remainingCells = 42 - days.length;
  for (let day = 1; day <= remainingCells; day++) {
    days.push({ day, isNextMonth: true });
  }

  return days;
});

// Shifts a (year, month) pair by `delta` months, wrapping the year as needed.
// `month` is 0-indexed, matching the native Date convention used throughout this file.
function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

function dayCellDate(day: CalendarDay): { year: number; month: number } {
  if (day.isPrevMonth) return shiftMonth(currentYear.value, currentMonth.value, -1);
  if (day.isNextMonth) return shiftMonth(currentYear.value, currentMonth.value, 1);
  return { year: currentYear.value, month: currentMonth.value };
}

function isToday(day: CalendarDay): boolean {
  if (day.day === null) return false;
  // Compare against "today" in MADE's venue timezone (Pacific), not the visitor's own
  // browser timezone, so this stays consistent with how events are bucketed below.
  const todayParts = getEventDateParts(new Date());
  const { year, month } = dayCellDate(day);

  return todayParts.year === year && todayParts.month === month && todayParts.day === day.day;
}

function getEventsForDay(day: CalendarDay): Event[] {
  if (day.day === null) return [];

  const { year, month } = dayCellDate(day);

  // Bucket events by their calendar day in MADE's venue timezone (Pacific), not the
  // visitor's own browser timezone, so an event always appears on the same day of the
  // calendar for everyone regardless of where they're viewing the site from.
  return allEvents.value.filter((event) => {
    const eventParts = getEventDateParts(new Date(event.startDate));
    return eventParts.year === year && eventParts.month === month && eventParts.day === day.day;
  });
}

function navigateMonth(direction: number) {
  const shifted = shiftMonth(currentYear.value, currentMonth.value, direction);
  currentYear.value = shifted.year;
  currentMonth.value = shifted.month;
  loadCalendarMonth(shifted.year, shifted.month);
}

function formatEventDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric',
    timeZone: EVENT_TIME_ZONE
  });
}

function getEventUrl(slug: string): string {
  return prependBase(`/event/${slug}`, props.locale || 'en-US');
}

function yearMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

// Fetched once and reused for the whole page load: tells us up front which months
// actually have a generated by_month blob, so we never have to speculatively fetch a
// month and handle a 404 for one that doesn't exist yet.
let monthsIndexPromise: Promise<Set<string>> | null = null;

function loadMonthsIndex(): Promise<Set<string>> {
  if (!monthsIndexPromise) {
    monthsIndexPromise = (async () => {
      try {
        const indexPath = prependBase('/event/by_month/index.json', props.locale);
        const response = await fetch(indexPath);
        if (!response.ok) {
          throw new Error(`Failed to load by_month index: ${response.statusText}`);
        }
        const data = await response.json();
        return new Set<string>(data.months || []);
      } catch (error) {
        console.error('Error loading by_month index:', error);
        return new Set<string>();
      }
    })();
  }
  return monthsIndexPromise;
}

async function fetchMonth(year: number, month: number): Promise<Event[]> {
  const key = yearMonthKey(year, month);
  const cached = monthCache.get(key);
  if (cached) {
    return cached;
  }

  const monthsIndex = await loadMonthsIndex();
  if (!monthsIndex.has(key)) {
    // No blob was generated for this month (no events at the last build) - the index
    // told us that up front, so there's no request to make.
    monthCache.set(key, []);
    return [];
  }

  try {
    const path = prependBase(`/event/by_month/${key}.json`, props.locale);
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load events for ${key}: ${response.statusText}`);
    }
    const data = await response.json();
    const items: Event[] = data.items || [];
    monthCache.set(key, items);
    return items;
  } catch (error) {
    console.error(`Error loading events for ${key}:`, error);
    return [];
  }
}

// Loads the events needed to render the visible grid: the displayed month plus its
// immediate neighbors, since the grid's leading/trailing cells show days that spill
// over into the previous/next month.
async function loadCalendarMonth(year: number, month: number): Promise<void> {
  const token = ++loadToken;
  loading.value = true;

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const [prevEvents, currentEvents, nextEvents] = await Promise.all([
    fetchMonth(prev.year, prev.month),
    fetchMonth(year, month),
    fetchMonth(next.year, next.month),
  ]);

  // A newer navigation superseded this one while we were fetching - drop this result.
  if (token !== loadToken) return;

  allEvents.value = [...prevEvents, ...currentEvents, ...nextEvents];
  loading.value = false;
}

const UPCOMING_EVENTS_TARGET = 5;
// Safety cap so a long dry spell with no events doesn't walk forward indefinitely.
const UPCOMING_LOOKAHEAD_MONTHS = 6;

function filterUpcoming(events: Event[], now: Date): Event[] {
  return events
    .filter((event) => {
      const startDate = new Date(event.startDate);
      const endDate = event.endDate ? new Date(event.endDate) : null;
      if (!endDate || isNaN(endDate.getTime())) {
        return startDate > now;
      }
      return startDate > now && endDate > now;
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

// Independent of whatever month the grid is currently browsing - always relative to
// real "now", walking forward month by month (reusing the same cache/index as the
// grid) until there are enough upcoming events or the lookahead cap is reached.
async function loadUpcomingEvents(): Promise<void> {
  const now = new Date();
  const todayParts = getEventDateParts(now);
  let year = todayParts.year;
  let month = todayParts.month;
  const collected: Event[] = [];

  for (let i = 0; i < UPCOMING_LOOKAHEAD_MONTHS; i++) {
    collected.push(...(await fetchMonth(year, month)));
    if (filterUpcoming(collected, now).length >= UPCOMING_EVENTS_TARGET) break;
    ({ year, month } = shiftMonth(year, month, 1));
  }

  upcomingEvents.value = filterUpcoming(collected, now).slice(0, UPCOMING_EVENTS_TARGET);
}

onMounted(async () => {
  await Promise.all([
    loadCalendarMonth(currentYear.value, currentMonth.value),
    loadUpcomingEvents(),
  ]);

  // The by_month blobs only change on a new deploy (triggered by the Contentful/
  // Eventbrite webhook), so there's nothing new to fetch here - but re-run this
  // periodically, using only already-cached data, so the "upcoming" cutoff keeps
  // moving forward as real time passes (e.g. an event starting pushes off the list).
  checkInterval = setInterval(() => {
    loadUpcomingEvents();
  }, 60000);
});

onBeforeUnmount(() => {
  if (checkInterval) {
    clearInterval(checkInterval);
  }
});
</script>

<style scoped>
/* Calendar-specific styles */
</style>

