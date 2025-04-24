"use client";
import SchedulePanel from "@/components/schedule-panel";
import { CalendarEvent, ScheduledTask, Task } from "../scheduler/classes.ts";
import { useRef, useState, useEffect } from "react"; // Import useEffect
import { Badge } from "@/components/ui/badge.tsx";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { getIdsAndNames } from "../api/calendar/get-ids-and-names.ts";
// Removed unused import: import CalendarSelectionForm from "@/components/calendar-selection.tsx";
import SignOut from "@/components/sign-out.tsx"; // Keep SignOut for the error case
import { getEvents } from "../api/calendar/get-events.ts";
import { compareISOTime, makeSchedule } from "@/app/scheduler/makeSchedule.ts";
import CalendarView from "@/components/calendar-view-v2.tsx";
import PreferencesDialog from "@/components/preferences-dialog.tsx";
// Correct the import path for useToast
import { useToast } from "@/hooks/use-toast"; // Corrected import path
import { cn } from "@/lib/utils"; // Import cn utility if not already present

// Define color constants (or move these to tailwind.config.js)
const colors = {
  pageBg: "bg-gray-50",
  mainBorder: "border-blue-300",
  panelLight: "bg-[#EED9C5]",
  panelDark: "bg-[#DCB8AC]",
  accent: "bg-[#6D4C41]", // Dark Brown
  accentText: "text-[#6D4C41]",
  accentBorder: "border-[#6D4C41]",
  bobaBg: "bg-[#D9E8E8]", // Light Blue-Grey
  bobaPearl: "bg-[#402C23]", // Darker Brown for pearls
  panelBorder: "border-[#C6B8A9]", // Subtle border for inside panels
  textLight: "text-white",
  textDark: "text-gray-800", // Default dark text
  textMuted: "text-gray-500",
};

export default function Schedule() {
  const [highPriorityTasks, setHighPriorityTasks] = useState<Task[]>([]);
  const [lowPriorityTasks, setLowPriorityTasks] = useState<Task[]>([]);
  // const [syntaxError, setSyntaxError] = useState(""); // No longer needed
  const [selectedCals, setSelectedCals] = useState<Array<string>>([]);
  const [selectedCalNames, setSelectedCalNames] = useState<Array<string>>([]);
  const [calendarSubmit, setCalendarSubmit] = useState(false); // Represents if events have been fetched *attempted*
  const [events, setEvents] = useState<Array<CalendarEvent>>([]);
  const [schedule, setSchedule] = useState<null | Array<
    CalendarEvent | ScheduledTask
  >>(null); // Represents if schedule has been generated
  const highInputRef = useRef<HTMLInputElement>(null);
  const lowInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast(); // Initialize toast function

  const { data: session, status: sessionStatus } = useSession(); // Renamed status to avoid conflict
  const {
    data: calendars,
    error: swrError, // Renamed error to avoid conflict
    isLoading: swrIsLoading, // Renamed isLoading to avoid conflict
  } = useSWR(
    // Only fetch if authenticated
    sessionStatus === "authenticated" ? "calendars" : null,
    () => getIdsAndNames(session?.accessToken)
  );

  // Effect for SWR/Auth loading/error states
  useEffect(() => {
    if (sessionStatus === "loading") {
      // Optionally show a loading toast, though it might flash
      // toast({ title: "Authenticating..." });
    } else if (sessionStatus === "unauthenticated") {
      toast({
        title: "Authentication Required",
        description: "Please sign in to load calendars.",
        variant: "destructive", // Or 'default' if less severe
      });
    } else if (swrIsLoading) {
      // Optionally show a loading toast for calendars
      // toast({ title: "Loading Calendars..." });
    } else if (swrError) {
      toast({
        title: "Error Loading Calendars",
        description:
          "Could not fetch calendar list. Please try signing out and back in.",
        variant: "destructive",
        // Optionally add an action, though SignOut is also rendered below
        // action: <ToastAction altText="Sign Out">Sign Out</ToastAction>,
      });
    } else if (
      sessionStatus === "authenticated" &&
      !swrIsLoading &&
      !calendars
    ) {
      // Handle case where loading finished but calendars array is still undefined/null/empty
      toast({
        title: "No Calendars Found",
        description: "Could not retrieve any calendars from your account.",
        variant: "default", // Or 'warning' if you add that variant
      });
    }
  }, [sessionStatus, swrIsLoading, swrError, calendars, toast]);

  // Effect to generate schedule automatically when events change and calendarSubmit is true
  useEffect(() => {
    if (calendarSubmit && events.length >= 0) {
      // Trigger even if 0 events fetched
      // Check if schedule is null to prevent re-generating if only tasks change
      // Or remove this check if you want schedule to auto-update when tasks change *after* initial generation
      if (schedule === null) {
        generateSchedule();
      }
    }
  }, [events, calendarSubmit]); // Depend on events and calendarSubmit

  console.log(
    `sessionStatus: ${sessionStatus}, swrError: ${swrError}, swrIsLoading ${swrIsLoading}, session ${session}`
  );
  console.log("calendars", calendars);

  function updateSelectedCals(id: string, summary: string) {
    let newSelectedCals;
    let newSelectedCalNames;

    if (selectedCals.includes(id)) {
      newSelectedCals = selectedCals.filter((item: string) => item !== id);
      newSelectedCalNames = selectedCalNames.filter(
        (item: string) => item !== summary
      );
    } else {
      newSelectedCals = [...selectedCals, id];
      newSelectedCalNames = [...selectedCalNames, summary];
    }

    setSelectedCals(newSelectedCals);
    setSelectedCalNames(newSelectedCalNames);

    // Reset subsequent steps if selection changes
    setCalendarSubmit(false);
    setEvents([]);
    setSchedule(null);
  }

  // Fetches events for selected calendars and triggers schedule generation via useEffect
  async function handleCalendarSubmit() {
    if (selectedCals.length === 0) {
      // Use toast for error
      toast({
        title: "Selection Error",
        description: "Please select at least one calendar.",
        variant: "destructive",
      });
      return;
    }
    // No need to clear error explicitly with toasts
    setSchedule(null); // Clear old schedule before fetching new events

    if (session && session.accessToken) {
      try {
        const caughtEvents = await getEvents(session.accessToken, selectedCals);
        console.log("Events fetched:", caughtEvents);
        setEvents(caughtEvents); // Update events state
        setCalendarSubmit(true); // Mark that fetch attempt was made, useEffect will handle generation
      } catch (err) {
        console.error("Error fetching events:", err);
        // Use toast for error
        toast({
          title: "Fetch Error",
          description: "Failed to fetch calendar events.",
          variant: "destructive",
        });
        setCalendarSubmit(false); // Ensure useEffect doesn't run on error
        setEvents([]);
      }
    }
  }

  function addTask(
    event: React.FormEvent,
    taskList: Task[],
    setTaskList: React.Dispatch<React.SetStateAction<Task[]>>
  ) {
    event.preventDefault();
    // Ensure event.target and event.target[0] are treated correctly
    const form = event.target as HTMLFormElement;
    const input = form[0] as HTMLInputElement;
    const rawText = input.value;
    const task = getTaskFromRawText(rawText); // This function now uses toast for errors
    if (task) {
      setTaskList([...taskList, task]);
      // If schedule exists, maybe regenerate it? Or provide a button to regenerate.
      // For now, adding a task won't auto-regenerate an existing schedule.
      // setSchedule(null); // Option: Clear schedule when tasks change?
    }
    form.reset();
  }

  function getTaskFromRawText(rawText: string): Task | null {
    const tagList = rawText.split("/");
    const unbreakable = rawText.includes("*");
    if (
      tagList.length < 2 ||
      tagList[0].trim() === "" ||
      tagList[1].trim() === ""
    ) {
      // Use toast for error
      toast({
        title: "Input Error",
        description:
          "Task needs a name and time estimate (e.g., 'Task Name / 30m').",
        variant: "destructive",
      });
      return null;
    }
    const name = tagList[0].trim();
    const timeText = tagList[1].trim();
    const minutes = getMinutesFromRawText(timeText); // This function now uses toast for errors

    if (minutes === null) {
      // Error is handled within getMinutesFromRawText
      return null;
    }

    let pref = null;
    if (tagList.length > 2) {
      const prefText = tagList[2].trim().toLowerCase();
      if (prefText === "") {
        // Allow empty preference string
      } else if (prefText.includes("am")) {
        pref = "am";
      } else if (prefText.includes("pm")) {
        pref = "pm";
      } else if (prefText.includes("eve")) {
        pref = "eve";
      } else {
        // Use toast for error
        toast({
          title: "Input Error",
          description: "Preference must be 'am', 'pm', or 'eve'.",
          variant: "destructive",
        });
        return null;
      }
    }

    // No need to clear error explicitly
    // @ts-ignore - Assuming Task constructor is correct
    return new Task(name, minutes, unbreakable, pref);
  }

  function getMinutesFromRawText(timeText: string): number | null {
    if (!timeText) {
      toast({
        title: "Input Error",
        description: "Time estimate cannot be empty.",
        variant: "destructive",
      });
      return null; // Handle empty string case
    }

    let totalMinutes = 0;
    const timeParts = timeText.toLowerCase().split(/(\d+)/).filter(Boolean); // Split around numbers

    let currentNumber: number | null = null;
    let foundUnit = false; // Track if h or m was found

    for (const part of timeParts) {
      const trimmedPart = part.trim();
      const num = parseInt(trimmedPart, 10);

      if (!isNaN(num)) {
        // If we already have a number waiting for a unit, it's an error (e.g., "30 45m")
        if (currentNumber !== null) {
          toast({
            title: "Time Format Error",
            description: `Invalid time format near '${trimmedPart}'. Use 'h' or 'm' after numbers.`,
            variant: "destructive",
          });
          return null;
        }
        currentNumber = num;
      } else if (currentNumber !== null) {
        if (trimmedPart.startsWith("h")) {
          totalMinutes += currentNumber * 60;
          currentNumber = null; // Reset after using the number
          foundUnit = true;
        } else if (trimmedPart.startsWith("m")) {
          totalMinutes += currentNumber;
          currentNumber = null; // Reset after using the number
          foundUnit = true;
        } else {
          // Unit not recognized immediately after number
          toast({
            title: "Time Format Error",
            description: `Invalid unit '${trimmedPart}'. Use 'h' for hours or 'm' for minutes.`,
            variant: "destructive",
          });
          return null; // Invalid format like "30x"
        }
      } else {
        // Part is not a number and no preceding number, invalid unless it's like "h" or "m" alone?
        // Let's consider this invalid for now. Requires number first.
        toast({
          title: "Time Format Error",
          description: `Invalid time format near '${trimmedPart}'. Expected number before unit.`,
          variant: "destructive",
        });
        return null;
      }
    }

    // If the last part was a number without a unit, assume minutes
    if (currentNumber !== null) {
      totalMinutes += currentNumber;
      foundUnit = true; // Consider a standalone number as minutes
    }

    // If no number or unit was effectively processed, it's an error
    if (
      totalMinutes === 0 &&
      !foundUnit &&
      timeText !== "0" &&
      !timeText.match(/^0[hm]/)
    ) {
      toast({
        title: "Time Format Error",
        description:
          "Invalid time format. Use numbers followed by 'h' or 'm' (e.g., '1h 30m', '45m').",
        variant: "destructive",
      });
      return null;
    }

    return totalMinutes;
  }

  // Generates the schedule using fetched events and current tasks
  function generateSchedule() {
    // This function is now primarily called by the useEffect hook
    // It relies on 'events' state being set correctly beforehand.
    // No need to check calendarSubmit here as useEffect handles that condition.

    // No need to clear error explicitly

    const highCopy = JSON.parse(JSON.stringify(highPriorityTasks));
    const lowCopy = JSON.parse(JSON.stringify(lowPriorityTasks));

    try {
      const scheduledTasksResult = makeSchedule(
        highCopy,
        lowCopy,
        events, // Use the events from state
        "07:00", // Example start time
        "22:00" // Example end time
      );
      console.log("Scheduled tasks generated:", scheduledTasksResult);

      const tasksAndEvents = [...scheduledTasksResult, ...events];
      tasksAndEvents.sort(compareStart);
      setSchedule(tasksAndEvents); // Set the final schedule state
    } catch (err) {
      console.error("Error during schedule generation:", err);
      // Use toast for error
      toast({
        title: "Scheduling Error",
        description: "An error occurred while creating the schedule.",
        variant: "destructive",
      });
      setSchedule(null); // Clear schedule on error
    }
  }

  // Define common button styles using color constants and increased rounding
  const baseButtonStyle =
    "px-4 py-2 rounded-lg w-full text-sm text-center shadow-sm"; // Increased padding/rounding, added shadow
  const enabledButtonStyle = cn(
    baseButtonStyle,
    colors.accent,
    colors.textLight,
    `hover:${colors.accent}/90`
  ); // Use cn for combining
  const disabledButtonStyle = cn(
    baseButtonStyle,
    "bg-gray-300",
    colors.textMuted,
    "cursor-not-allowed"
  );
  const outlineButtonStyle = cn(
    baseButtonStyle,
    colors.accentBorder,
    colors.accentText,
    "border hover:bg-opacity-10 hover:bg-black"
  ); // Use accent colors
  const placeholderButtonStyle = cn(
    baseButtonStyle,
    "bg-gray-400",
    colors.textLight,
    "cursor-not-allowed"
  ); // Keep placeholder distinct

  // Determine if the main content area should be rendered
  const canDisplayContent =
    sessionStatus === "authenticated" && !swrIsLoading && calendars;
  const showLoadingPlaceholder =
    sessionStatus === "loading" ||
    (sessionStatus === "authenticated" && swrIsLoading);
  const showAuthError = sessionStatus === "unauthenticated";
  const showSwrError = sessionStatus === "authenticated" && swrError;

  return (
    <>
      {/* Reminder: Ensure <Toaster /> is included ... */}
      {/* Apply page background */}
      <div
        className={cn(
          "flex h-screen max-h-screen overflow-hidden p-8",
          colors.pageBg
        )}
      >
        {/* Main container with border and increased rounding */}
        <div className={"flex flex-grow gap-x-5 rounded-2xl p-6"}>
          {/* Left Panel */}
          <div className="w-2/3 gap-y-5 flex flex-col h-full">
            <p className="text-3xl font-semibold py-3 text-gray-800">
              Prioriteas
            </p>{" "}
            {/* Adjusted text color */}
            {/* Need to do Panel */}
            <div
              className={cn(
                "relative flex flex-col h-[45%] min-h-0 rounded-xl shadow-md overflow-hidden", // Added shadow, overflow-hidden
                colors.panelLight // Apply panel background
              )}
              onClick={() => highInputRef.current?.focus()}
            >
              {/* Boba Pearls Graphic */}
              <div className="absolute bottom-3 left-3 flex gap-1">
                <div
                  className={cn("w-2 h-2 rounded-full", colors.bobaPearl)}
                ></div>
                <div
                  className={cn("w-3 h-3 rounded-full", colors.bobaPearl)}
                ></div>
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full mt-1",
                    colors.bobaPearl
                  )}
                ></div>
              </div>
              <p
                className={cn(
                  "p-3 font-medium",
                  colors.panelBorder,
                  colors.textDark
                )}
              >
                {" "}
                {/* Adjusted padding/border/text */}
                Need to do
              </p>{" "}
              <div className="flex-1 overflow-y-auto pl-5 pr-2 pt-2">
                {" "}
                {/* Added pt-2 */}
                {highPriorityTasks.map((task, id) =>
                  getListElementFromTask(
                    task,
                    id,
                    highPriorityTasks,
                    setHighPriorityTasks
                  )
                )}
                <form
                  className="w-full"
                  onSubmit={(e) =>
                    addTask(e, highPriorityTasks, setHighPriorityTasks)
                  }
                >
                  <input
                    ref={highInputRef}
                    type="text"
                    placeholder="Task / Time / Pref (e.g., Work / 2h / am)"
                    className="w-full focus:outline-none p-1 bg-transparent text-sm" // Ensure bg is transparent
                  ></input>
                </form>
              </div>
            </div>
            {/* Lower Left Section */}
            <div className="flex h-[45%] min-h-0 gap-x-4">
              {/* Want to do Panel */}
              <div
                className={cn(
                  "relative flex flex-col w-3/4 h-full rounded-xl shadow-md overflow-hidden", // Added shadow, overflow-hidden
                  colors.panelLight // Apply panel background
                )}
                onClick={() => lowInputRef.current?.focus()}
              >
                {/* Boba Pearls Graphic */}
                <div className="absolute bottom-3 left-3 flex gap-1">
                  <div
                    className={cn("w-2 h-2 rounded-full", colors.bobaPearl)}
                  ></div>
                  <div
                    className={cn("w-3 h-3 rounded-full", colors.bobaPearl)}
                  ></div>
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full mt-1",
                      colors.bobaPearl
                    )}
                  ></div>
                </div>
                <p
                  className={cn(
                    "p-3 font-medium",
                    colors.panelBorder,
                    colors.textDark
                  )}
                >
                  {" "}
                  {/* Adjusted padding/border/text */}
                  Want to do
                </p>{" "}
                <div className="flex-1 overflow-y-auto pl-5 pr-2 pt-2">
                  {" "}
                  {/* Added pt-2 */}
                  {lowPriorityTasks.map((task, id) =>
                    getListElementFromTask(
                      task,
                      id,
                      lowPriorityTasks,
                      setLowPriorityTasks
                    )
                  )}
                  <form
                    className="w-full"
                    onSubmit={(e) =>
                      addTask(e, lowPriorityTasks, setLowPriorityTasks)
                    }
                  >
                    <input
                      ref={lowInputRef}
                      type="text"
                      placeholder="Fun task / 1h 30m / eve"
                      className="w-full focus:outline-none p-1 bg-transparent text-sm" // Ensure bg is transparent
                    ></input>
                  </form>
                </div>
              </div>

              {/* Buttons and Image Area */}
              <div className="w-1/4 flex flex-col gap-y-2 h-full">
                {/* Buttons Container */}
                <div className="flex flex-col gap-y-2 w-full">
                  {/* Button 1: Preferences */}
                  <PreferencesDialog>
                    <button type="button" className={outlineButtonStyle}>
                      Set Preferences
                    </button>
                  </PreferencesDialog>

                  {/* Button 2: Make Schedule */}
                  <button
                    type="button"
                    onClick={generateSchedule}
                    disabled={!schedule || !canDisplayContent}
                    className={
                      !schedule || !canDisplayContent
                        ? disabledButtonStyle
                        : enabledButtonStyle // Use accent color button style
                    }
                  >
                    Make Schedule
                  </button>
                </div>

                {/* Image Placeholder (Boba) */}
                <div
                  className={cn(
                    "w-full flex-grow rounded-xl flex items-center justify-center text-gray-500 mt-2 shadow-md", // Added shadow
                    colors.bobaBg // Apply boba background color
                  )}
                >
                  <p>Image Placeholder</p>
                </div>
              </div>
            </div>
          </div>
          {/* Right Panel */}
          <div
            className={cn(
              "h-full overflow-y-auto w-[70%] flex-1 p-4 rounded-xl shadow-md", // Added shadow
              colors.panelDark // Apply panel background
            )}
          >
            <div>
              {/* Conditional Rendering based on states */}
              {showLoadingPlaceholder && (
                <p className={cn("text-center p-4", colors.textMuted)}>
                  Loading...
                </p>
              )}
              {showAuthError && (
                <div className="text-center p-4">
                  <p className="text-red-600 mb-2">Authentication required.</p>
                </div>
              )}
              {showSwrError && (
                <div className="text-center p-4">
                  <p className="text-red-600 mb-2">
                    Error loading calendar data.
                  </p>
                  <SignOut />
                </div>
              )}
              {/* Main content */}
              {canDisplayContent && calendars && (
                <div>
                  {schedule ? (
                    // Schedule View
                    <div className="flex flex-col gap-y-1">
                      <div className="flex justify-start items-center mb-4 gap-2">
                        {" "}
                        {/* Increased mb */}
                        <button
                          className="p-2 bg-white/50 text-gray-800 rounded-lg hover:bg-white/70 flex items-center text-sm shadow-sm" // Adjusted style
                          onClick={() => {
                            setSchedule(null);
                            setCalendarSubmit(false);
                            setEvents([]);
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            {" "}
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 19l-7-7 7-7"
                            />{" "}
                          </svg>
                        </button>
                        <p
                          className={cn(
                            "text-3xl font-semibold",
                            colors.textDark
                          )}
                        >
                          Plan
                        </p>{" "}
                        {/* Adjusted size/color */}
                      </div>
                      <CalendarView
                        events={schedule}
                        tasks={[]}
                        start="07:00"
                        end="22:00"
                        height={90}
                        // Pass colors to CalendarView if it accepts them, otherwise style internally
                        // Example: eventBgColor={colors.panelLight} hourColor={colors.textDark}
                      />
                    </div>
                  ) : (
                    // Calendar Selection View
                    <>
                      <p className={cn("mb-2 text-sm", colors.textDark)}>
                        {" "}
                        {/* Adjusted color */}
                        Select the calendars to include events from:
                      </p>
                      {/* Selected Badges */}
                      <div className="flex flex-wrap gap-2 my-2 min-h-[2rem]">
                        {selectedCalNames.length > 0 ? (
                          selectedCalNames.map((name, idx) => (
                            <div
                              key={idx}
                              // Use accent color for selected badges
                              className={cn(
                                "flex items-center px-2.5 py-1 rounded-full text-xs shadow-sm",
                                colors.accent,
                                colors.textLight
                              )}
                            >
                              <span>{name}</span>
                              <button
                                className={cn(
                                  "ml-1.5 opacity-70 hover:opacity-100 focus:outline-none",
                                  colors.textLight
                                )}
                                onClick={() =>
                                  updateSelectedCals(selectedCals[idx], name)
                                }
                                aria-label={`Remove ${name}`}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3 w-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                >
                                  {" "}
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M6 18L18 6M6 6l12 12"
                                  />{" "}
                                </svg>
                              </button>
                            </div>
                          ))
                        ) : (
                          <p
                            className={cn(
                              "italic",
                              colors.textMuted,
                              "text-sm"
                            )}
                          >
                            No calendars selected
                          </p>
                        )}
                      </div>
                      {/* Calendar List */}
                      <div
                        className={cn(
                          "flex flex-col border rounded-lg max-h-60 overflow-y-auto mb-4 bg-white/30 shadow-sm",
                          colors.panelBorder
                        )}
                      >
                        {" "}
                        {/* Adjusted border/bg */}
                        {calendars.map((item, idx) => (
                          <button
                            key={item.id || idx}
                            className={cn(
                              "text-left text-sm py-1.5 px-3 border-b last:border-b-0 hover:bg-black/5", // Adjusted padding/hover
                              colors.panelBorder, // Use subtle border
                              selectedCals.includes(item.id)
                                ? cn("font-medium", colors.accentText) // Style for selected
                                : colors.textDark
                            )}
                            onClick={() =>
                              updateSelectedCals(item.id, item.summary)
                            }
                          >
                            {item.summary}
                          </button>
                        ))}
                      </div>
                      {/* Get Events & Generate Schedule Button */}
                      <button
                        onClick={handleCalendarSubmit}
                        disabled={selectedCals.length === 0}
                        className={
                          selectedCals.length === 0
                            ? disabledButtonStyle
                            : enabledButtonStyle // Use accent color button style
                        }
                      >
                        Get Events & Make Schedule
                      </button>
                    </>
                  )}
                </div>
              )}{" "}
              {/* End canDisplayContent check */}
            </div>
          </div>{" "}
          {/* End Right Panel */}
        </div>{" "}
        {/* End Main Container */}
      </div>{" "}
      {/* End Page Container */}
    </>
  );
}

function getListElementFromTask(
  task: Task,
  id: number,
  taskList: Task[],
  setTaskList: React.Dispatch<React.SetStateAction<Task[]>>
) {
  function deleteTask(idToDelete: number) {
    const updatedList = taskList.filter((_, index) => index !== idToDelete);
    setTaskList(updatedList);
  }

  return (
    <div
      className="group flex justify-between items-center my-1 hover:bg-black/5 p-1 rounded-md" // Subtle hover, rounded-md
      key={id}
    >
      <div className="flex items-center gap-x-2 flex-wrap mr-2">
        <p className={cn("text-sm", colors.textDark)}>{task.name}</p>
        <Badge
          variant="secondary"
          className="text-xs bg-black/10 text-gray-700 border-none"
        >
          {" "}
          {/* Adjusted badge style */}
          {task.getTimeText()}
        </Badge>
        {task.pref && (
          <Badge
            variant="outline"
            className={cn("text-xs", colors.accentBorder, colors.accentText)}
          >
            {" "}
            {/* Accent outline badge */}
            pref {task.pref}
          </Badge>
        )}
        {task.unbreakable && (
          <Badge
            variant="outline"
            className={cn("text-xs", colors.accentBorder, colors.accentText)}
          >
            {" "}
            {/* Accent outline badge */}
            no split
          </Badge>
        )}
      </div>
      <button
        className="hidden group-hover:flex items-center justify-center text-red-500 hover:text-red-700 p-0.5 rounded-full focus:outline-none focus:bg-red-100" // Adjusted padding/focus
        onClick={() => deleteTask(id)}
        aria-label={`Delete task ${task.name}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          {" "}
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />{" "}
        </svg>
      </button>
    </div>
  );
}

// Helper function to compare start times of CalendarEvent or ScheduledTask objects
// Ensure compareISOTime is correctly imported from "@/app/scheduler/makeSchedule.ts"
function compareStart(
  elem1: CalendarEvent | ScheduledTask,
  elem2: CalendarEvent | ScheduledTask
): number {
  const time1 = elem1?.start;
  const time2 = elem2?.start;

  // Handle cases where start times might be missing
  if (!time1 && !time2) return 0; // Both missing, consider equal
  if (!time1) return 1; // Put items without start time last
  if (!time2) return -1; // Put items without start time last

  // Use the imported compareISOTime for reliable comparison
  return compareISOTime(time1, time2);
}
