"use client";

import React from "react"; // Import React
import { CalendarEvent, ScheduledTask, Task } from "@/app/scheduler/classes";
import {
  addMinutesToISO,
  getTimeBetweenISO,
  compareISOTime,
} from "@/app/scheduler/makeSchedule.ts";

/**
 * Generates an array of numbers within a specified range.
 * @param start The starting number of the sequence.
 * @param stop The end number of the sequence (exclusive).
 * @param step The increment between numbers. Defaults to 1.
 * @returns An array of numbers.
 */
var range = (start: number, stop: number, step = 1) => {
  const length = Math.ceil((stop - start) / step);
  return Array.from({ length }, (_, i) => i * step + start);
};

/**
 * Interface defining the layout information for a calendar event.
 */
interface LayoutInfo {
  event: CalendarEvent | ScheduledTask; // The event or task itself.
  hIndex: number; // Horizontal index (0, 1, 2...) representing the column/lane within the overlapping group.
  maxOverlap: number; // Maximum number of concurrent events this event overlaps with at any point during its duration.
}

/**
 * Calculates horizontal layout information for potentially overlapping events.
 * This function determines how events should be positioned horizontally to avoid visual overlap.
 * Assumes the input 'events' array is sorted by start time.
 * @param events An array of CalendarEvent or ScheduledTask objects, sorted by start time.
 * @returns An array of LayoutInfo objects, one for each input event, containing layout details.
 */
function calculateLayout(
  events: (CalendarEvent | ScheduledTask)[]
): LayoutInfo[] {
  // Initialize layout results with default values for each event.
  const layoutResults: LayoutInfo[] = events.map((e) => ({
    event: e,
    hIndex: 0, // Default horizontal index is 0.
    maxOverlap: 1, // Default max overlap is 1 (itself).
  }));

  // Stores indices (from the original 'events' array) of events that are currently "active" or ongoing.
  const activeEventIndices: number[] = [];

  // Iterate through each event to calculate its layout.
  for (let i = 0; i < events.length; i++) {
    const currentEvent = events[i];

    // --- Clean up active events ---
    // Remove events from the active list that have finished *before* the current event starts.
    let k = 0;
    while (k < activeEventIndices.length) {
      const activeIdx = activeEventIndices[k];
      // Compare the end time of the active event with the start time of the current event.
      if (
        compareISOTime(
          layoutResults[activeIdx].event.end,
          currentEvent.start
        ) <= 0 // If active event ends before or exactly when current event starts
      ) {
        // Remove the finished event from the active list.
        activeEventIndices.splice(k, 1);
      } else {
        // Move to the next active event.
        k++;
      }
    }

    // --- Determine horizontal position (hIndex) ---
    // Find the first available horizontal index (column/lane) for the current event.
    // Collect the horizontal indices already used by the currently active events.
    const usedIndices = new Set(
      activeEventIndices.map((idx) => layoutResults[idx].hIndex)
    );
    let currentHIndex = 0;
    // Increment hIndex until an unused index is found.
    while (usedIndices.has(currentHIndex)) {
      currentHIndex++;
    }
    // Assign the found available hIndex to the current event.
    layoutResults[i].hIndex = currentHIndex;

    // --- Add current event to active list ---
    activeEventIndices.push(i); // Add the index of the current event.

    // --- Update maxOverlap for all currently active events ---
    // The number of currently active events represents the current overlap count.
    const currentOverlapCount = activeEventIndices.length;
    // For each event currently active (including the one just added),
    // update its maxOverlap if the current overlap count is greater than its previously recorded maxOverlap.
    activeEventIndices.forEach((idx) => {
      layoutResults[idx].maxOverlap = Math.max(
        layoutResults[idx].maxOverlap,
        currentOverlapCount
      );
    });
  }

  // Return the array containing layout information for all events.
  return layoutResults;
}

/**
 * React component to display a calendar view with events and tasks.
 * Handles overlapping events by calculating and applying horizontal layout.
 */
export default function CalendarView({
  events, // Array of CalendarEvents and ScheduledTasks to display.
  tasks, // Array of Tasks (currently unused in rendering).
  start, // Start time of the calendar view (e.g., "07:00").
  end, // End time of the calendar view (e.g., "22:00").
  height, // Total height of the calendar view in vh units.
}: {
  events: (CalendarEvent | ScheduledTask)[]; // Combined type for events and scheduled tasks.
  tasks: Task[]; // Keep tasks prop if needed elsewhere, but it's unused here.
  start: string; // ISO time string for the start of the day view.
  end: string; // ISO time string for the end of the day view.
  height: number; // Height of the calendar container in vh units.
}) {
  // --- Calculate Grid Dimensions ---
  // Calculate the total number of rows needed (one row per hour).
  const rows = Math.ceil(getTimeBetweenISO(start, end) / 60);
  // Calculate the height of each row in vh units.
  const rowH = height / rows;

  // --- Prepare Events for Layout ---
  // Ensure the combined list of events and scheduled tasks is sorted by start time.
  // The calculateLayout function relies on this sorting.
  // Create a copy to avoid mutating the original prop array.
  const sortedEvents = [...events].sort((a, b) =>
    compareISOTime(a.start, b.start)
  );

  // --- Calculate Layout ---
  // Determine the horizontal positioning (hIndex, maxOverlap) for each event.
  const eventLayouts = calculateLayout(sortedEvents);

  // --- Render Component ---
  return (
    <div
      className="" // Placeholder for potential future Tailwind classes.
      style={{
        height: height.toString() + "vh", // Set the total height.
        display: "grid", // Use CSS Grid for layout.
        gridTemplateColumns: "50px auto", // Define two columns: one for time labels, one for events.
        position: "relative", // Establish a positioning context for event blocks.
      }}
    >
      {/* --- Render Hour Background Lines and Time Labels --- */}
      {range(0, rows).map((rowI) => (
        // Use React.Fragment to group elements for each hour without adding extra DOM nodes.
        <React.Fragment key={`hour-bg-${rowI}`}>
          {/* Time Label Column */}
          <div
            style={{
              gridRowStart: rowI + 1, // Grid rows are 1-indexed.
              gridRowEnd: rowI + 2,
              gridColumn: 1, // Place in the first column.
              height: rowH.toString() + "vh", // Set the height of the time label cell.
              display: "flex",
              alignItems: "flex-start", // Align time label to the top.
              justifyContent: "flex-end", // Align time label to the right.
              paddingRight: "4px", // Add some space between the time label and the hour line.
            }}
          >
            {/* Display the time label (e.g., "07:00", "08:00"). */}
            <p className="text-xs text-gray-500">
              {addMinutesToISO(start, rowI * 60)}
            </p>
          </div>
          {/* Hour Line Column */}
          <div
            style={{
              gridRowStart: rowI + 1,
              gridRowEnd: rowI + 2,
              gridColumn: 2, // Place in the second column (event area).
              borderTop: "1px solid #e0e0e0", // Draw a light gray line at the top of each hour row.
            }}
          ></div>
        </React.Fragment>
      ))}

      {/* --- Render Event Blocks --- */}
      {/* Map through the calculated layout information to render each event. */}
      {eventLayouts.map((layout, id) =>
        // Call getTimeBlockDiv for each event to generate its corresponding div.
        getTimeBlockDiv(
          layout.event, // The event data.
          start, // Start time of the view.
          rows, // Total number of rows.
          rowH, // Height of one row.
          layout.hIndex, // Calculated horizontal index.
          layout.maxOverlap, // Calculated maximum overlap.
          id // Unique key for React list rendering.
        )
      )}

      {/* Example placeholder div (commented out) */}
      {/* <div style={{"gridColumnStart": 2, "gridRowStart": 8, "gridRowEnd": 11, "backgroundColor": "black", "opacity": .6, "marginTop": "2vh", "marginBottom": "2vh"}}>
                i span a few columns
            </div> */}
    </div>
  );
}

/**
 * Calculates the starting/ending grid row index and the vertical offset (margin) for an event time.
 * @param isEnd Boolean flag: true if calculating for the event's end time, false for the start time.
 * @param eventTime The specific start or end time string (e.g., "09:30").
 * @param dayStart The start time of the entire calendar view (e.g., "07:00").
 * @param numRows The total number of rows (hours) in the calendar view (Note: not directly used in current logic).
 * @param rowH The height of a single row (hour) in vh units.
 * @returns A tuple: [gridRowIndex, marginString].
 *          gridRowIndex: The 1-based index for grid-row-start or grid-row-end.
 *          marginString: The CSS value for marginTop or marginBottom (e.g., "1.2345vh").
 */
function getIdxAndOffset(
  isEnd: boolean,
  eventTime: string,
  dayStart: string,
  numRows: number, // Keep param for potential future use, though not used now
  rowH: number
): [number, string] {
  // Calculate total minutes from the start of the day view to the event time.
  const minutesBetween = getTimeBetweenISO(dayStart, eventTime);
  // Calculate the number of full hours elapsed since the day view started.
  const hoursElapsed = Math.floor(minutesBetween / 60);
  // Calculate the minutes past the last full hour mark.
  const minutesInHour = minutesBetween % 60;

  // Grid rows are 1-indexed. Row 'h' represents the time slot for the h-th hour of the view.
  // The grid line *before* row 'h' is line 'h'. The line *after* row 'h' is line 'h+1'.
  // Example: dayStart=07:00. Row 1 = 07:00-08:00 slot, between lines 1 and 2. Row 12 = 18:00-19:00 slot, between lines 12 and 13.

  if (isEnd) {
    // --- Calculate grid-row-end and marginBottom ---
    // Determine the grid line number corresponding to the hour mark the event ends at or within.
    // e.g., ends 19:30 -> hoursElapsed=12 -> line is 12+1 = 13 (19:00 line)
    // e.g., ends 20:00 -> hoursElapsed=13 -> line is 13+1 = 14 (20:00 line)
    const endHourLine = hoursElapsed + 1;

    if (minutesInHour === 0) {
      // Event ends exactly on the hour line 'endHourLine'.
      // The grid-row-end should be this line number. No bottom margin needed.
      return [endHourLine, "0vh"];
    } else {
      // Event ends *within* the hour slot that starts at 'endHourLine'.
      // The grid-row-end needs to be the *next* line after the slot finishes.
      const gridRowEnd = endHourLine + 1;
      // Calculate the bottom margin: represents the empty space *after* the event
      // within that final hour slot.
      const marginPercent = (60 - minutesInHour) / 60;
      const marginString = (marginPercent * rowH).toFixed(4) + "vh";
      return [gridRowEnd, marginString];
    }
  } else {
    // --- Calculate grid-row-start and marginTop ---
    // Determine the grid line number corresponding to the hour mark the event starts at or within.
    // e.g., starts 18:00 -> hoursElapsed=11 -> line is 11+1 = 12 (18:00 line)
    // e.g., starts 18:30 -> hoursElapsed=11 -> line is 11+1 = 12 (18:00 line)
    const startHourLine = hoursElapsed + 1;

    if (minutesInHour === 0) {
      // Event starts exactly on the hour line 'startHourLine'.
      // The grid-row-start should be this line number. No top margin needed.
      return [startHourLine, "0vh"];
    } else {
      // Event starts *within* the hour slot beginning at 'startHourLine'.
      // The grid-row-start is still this line number.
      // Calculate the top margin: represents the empty space *before* the event
      // within that first hour slot.
      const marginPercent = minutesInHour / 60;
      const marginString = (marginPercent * rowH).toFixed(4) + "vh";
      return [startHourLine, marginString];
    }
  }
}

/**
 * Generates the style and JSX for a single event block div.
 * @param event The CalendarEvent or ScheduledTask to render.
 * @param start The start time of the calendar view.
 * @param rows Total number of rows (hours) in the view.
 * @param rowH Height of one row in vh.
 * @param hIndex Horizontal index (0, 1, 2...) for positioning within overlaps.
 * @param maxOverlap Max concurrent events this event overlaps with.
 * @param key Unique key for React list rendering.
 * @returns JSX element representing the event block, or a React Fragment if the event is outside the view.
 */
function getTimeBlockDiv(
  event: CalendarEvent | ScheduledTask,
  start: string,
  rows: number,
  rowH: number,
  hIndex: number,
  maxOverlap: number,
  key: number
) {
  // Calculate the end time of the viewable day range.
  const dayEnd = addMinutesToISO(start, rows * 60);

  // --- Check if Event is Outside Viewable Range ---
  // If the event ends before the view starts, or starts after the view ends, don't render it.
  if (
    compareISOTime(event.end, start) <= 0 ||
    compareISOTime(event.start, dayEnd) >= 0
  ) {
    // Return an empty fragment with a key for React reconciliation.
    return <React.Fragment key={key}></React.Fragment>;
  }

  // --- Clamp Event Times to Viewable Range ---
  // If event starts before the view, use the view's start time for calculation.
  const effectiveStart =
    compareISOTime(event.start, start) < 0 ? start : event.start;
  // If event ends after the view, use the view's end time for calculation.
  const effectiveEnd =
    compareISOTime(event.end, dayEnd) > 0 ? dayEnd : event.end;

  // --- Calculate Vertical Positioning (Using original logic) ---
  let rowStart, startOffset;
  [rowStart, startOffset] = getIdxAndOffset(
    false, // Calculating for start time
    effectiveStart,
    start,
    rows,
    rowH
  );

  let rowEnd, endOffset;
  [rowEnd, endOffset] = getIdxAndOffset(
    true, // Calculating for end time
    effectiveEnd,
    start,
    rows,
    rowH
  );

  // --- Calculate Horizontal Positioning (Corrected logic for left alignment) ---
  const horizontalGap = maxOverlap > 1 ? 2 : 0; // Gap in pixels between items
  const totalGapWidth = (maxOverlap - 1) * horizontalGap;
  const itemWidthCss = `calc((100% - ${totalGapWidth}px) / ${maxOverlap})`;
  const marginLeftCss =
    hIndex === 0
      ? "0px" // First item has no margin
      : `calc(${hIndex} * (${itemWidthCss} + ${horizontalGap}px))`;

  // --- Define CSS Styles (Reverted to relative positioning with margins) ---
  const style: React.CSSProperties = {
    // Grid placement
    gridColumnStart: 2,
    gridRowStart: rowStart, // Use grid rows for vertical span
    gridRowEnd: rowEnd, // Use grid rows for vertical span

    // Positioning and Stacking
    position: "relative", // Keep items in the grid flow
    zIndex: hIndex + 1,

    // Horizontal Sizing and Spacing (Corrected logic)
    width: itemWidthCss,
    marginLeft: marginLeftCss, // Use marginLeft, not left

    // Vertical Spacing (Margins)
    marginTop: startOffset, // Use marginTop for vertical offset
    marginBottom: endOffset, // Use marginBottom for vertical offset

    // Visual Appearance
    backgroundColor: "pink", // Default background for CalendarEvent.
    fontSize: "12px", // Small font size.
    border: "1px solid #a0a0a0", // Border around the event block.
    borderRadius: "3px", // Slightly rounded corners.
    overflow: "hidden", // Hide content that overflows the block.
    padding: "2px 4px", // Internal padding.
    boxSizing: "border-box", // Include padding and border in width/height calculation.
    color: "#333", // Dark text color for readability.
  };

  // --- Apply Specific Styles for Scheduled Tasks ---
  if (event instanceof ScheduledTask) {
    style.backgroundColor = "lightblue"; // Different background for tasks.
    style.borderColor = "#60a5fa"; // Matching blue border for tasks.
  }

  // --- Return JSX ---
  return (
    // Apply the calculated style to the div.
    // Use the provided key for React list efficiency.
    <div style={style} key={key}>
      {/* Display event name, truncate if too long, adjust line height. */}
      <p className="font-medium truncate leading-tight">{event.name}</p>
      {/* Display effective start and end times, truncate if too long, adjust line height. */}
      <p className="text-xs truncate leading-tight">
        {effectiveStart} - {effectiveEnd}
      </p>
    </div>
  );
}
