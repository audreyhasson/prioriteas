"use client";
import SchedulePanel from "@/components/schedule-panel";
import { CalendarEvent, ScheduledTask, Task } from "../scheduler/classes.ts";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge.tsx";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { getIdsAndNames } from "../api/calendar/get-ids-and-names.ts";
import CalendarSelectionForm from "@/components/calendar-selection.tsx";
import SignOut from "@/components/sign-out.tsx";
import { getEvents } from "../api/calendar/get-events.ts";
import { compareISOTime, makeSchedule } from "@/app/scheduler/makeSchedule.ts";
import CalendarView from "@/components/calendar-view-v2.tsx";

export default function Schedule() {
  const [highPriorityTasks, setHighPriorityTasks] = useState<Task[]>([]);
  const [lowPriorityTasks, setLowPriorityTasks] = useState<Task[]>([]);
  const [syntaxError, setSyntaxError] = useState("");
  const [selectedCals, setSelectedCals] = useState<Array<string>>([]);
  // track selected calendar names for display
  const [selectedCalNames, setSelectedCalNames] = useState<Array<string>>([]);
  const [calendarSubmit, setCalendarSubmit] = useState(false);
  const [events, setEvents] = useState<Array<CalendarEvent>>([]);
  const [schedule, setSchedule] = useState<null | Array<
    CalendarEvent | ScheduledTask
  >>(null);
  const highInputRef = useRef<HTMLInputElement>(null);
  const lowInputRef = useRef<HTMLInputElement>(null);

  const { data: session, status } = useSession();
  const {
    data: calendars,
    error,
    isLoading,
  } = useSWR("bazooka", (any) => getIdsAndNames(session.accessToken));

  console.log(
    `status: ${status}, error: ${error}, isLoading ${isLoading}, session ${session}`
  );
  console.log("calendars", calendars);
  function updateSelectedCals(id: string, summary: string) {
    if (selectedCals.includes(id)) {
      const newList = selectedCals.filter((item: string) => item !== id);
      const newNameList = selectedCalNames.filter(
        (item: string) => item !== summary
      );
      setSelectedCals(newList);
      setSelectedCalNames(newNameList);
    } else {
      setSelectedCals([...selectedCals, id]);
      setSelectedCalNames([...selectedCalNames, summary]);
    }
  }

  async function handleCalendarSubmit() {
    // Check if any calendars are selected
    if (selectedCals.length === 0) {
      setSyntaxError("Please select at least one calendar to continue.");
      return;
    }

    // Clear any previous error
    setSyntaxError("");

    // pass in selected Ids to get events api function
    if (session && session.accessToken) {
      const caughtEvents = await getEvents(session.accessToken, selectedCals);
      console.log("caught", caughtEvents);
      setCalendarSubmit(true);
      setEvents(caughtEvents);
    }
  }

  function addTask(
    event: React.FormEvent,
    taskList: Task[],
    setTaskList: React.Dispatch<React.SetStateAction<Task[]>>
  ) {
    event.preventDefault();
    const rawText = event.target[0].value;
    const task = getTaskFromRawText(rawText);
    if (task) setTaskList([...taskList, task]);

    event.target.reset();
  }

  function getTaskFromRawText(rawText: string): Task | null {
    // Parse name, time, and pref
    // Should be in form name / time / pref, send error otherwise
    // Times could be in many forms
    const tagList = rawText.split("/");
    if (tagList.length < 2) {
      setSyntaxError(
        "Need to include a name and a time estimate, separated by a slash, with every task"
      );
      return null;
    }
    const name = tagList[0].trim();
    const timeText = tagList[1].trim();
    const minutes = getMinutesFromRawText(timeText);
    if (!minutes) {
      setSyntaxError("The time expression doesn't include numbers");
      return null;
    }
    let pref = null;
    if (tagList.length > 2) {
      const prefText = tagList[2].toLowerCase();
      if (prefText.includes("am")) {
        pref = "am";
      } else if (prefText.includes("pm")) {
        pref = "pm";
      } else if (prefText.includes("eve")) {
        pref = "eve";
      } else {
        setSyntaxError("Indicated 'prefs' must be either am, pm or eve");
        return null;
      }
    }
    setSyntaxError("");
    // @ts-ignore
    return new Task(name, minutes, pref);
  }

  function getMinutesFromRawText(timeText: string) {
    // if there are hours, get the hours
    let hours = 0;
    const hIdx = timeText.indexOf("h");
    if (hIdx != -1) {
      const hourRawText = timeText.slice(0, hIdx);
      hours = parseInt(hourRawText.trim());
      if (Number.isNaN(hours)) {
        return null;
      }
      timeText = timeText.slice(hIdx);
    }
    // Get to the next space or number
    while (timeText.length > 0 && /[A-Za-z]/.test(timeText[0])) {
      timeText = timeText.slice(1);
    }
    let minutes = 0;
    const mIdx = timeText.indexOf("m");
    if (mIdx != -1) {
      const minRawText = timeText.slice(0, mIdx);
      minutes = parseInt(minRawText.trim());
      if (Number.isNaN(minutes)) {
        return null;
      }
    }
    return hours * 60 + minutes;
  }

  function generateSchedule(e: React.FormEvent) {
    e.preventDefault();
    // Making copies of tasks to send into schedule maker
    const highCopy = JSON.parse(JSON.stringify(highPriorityTasks));
    const lowCopy = JSON.parse(JSON.stringify(lowPriorityTasks));
    const scheduledTasks = makeSchedule(
      highCopy,
      lowCopy,
      events,
      "07:00",
      "22:00"
    );
    console.log("just made", scheduledTasks);
    // Merge tasks and events into list sorted by time
    const tasksAndEvents = [...scheduledTasks, ...events];
    tasksAndEvents.sort(compareStart);
    setSchedule(tasksAndEvents);
  }

  return (
    <>
      <div className="flex h-screen max-h-screen overflow-hidden gap-x-5 p-8">
        <div className="w-2/3 gap-y-5 flex flex-col h-full">
          <p>Prioriteas</p>
          <div className="h-6">
            {" "}
            {/* Adjust height as needed */}
            {syntaxError && (
              <p className="text-red-500 text-sm">{syntaxError}</p>
            )}
          </div>
          <div
            className="outline rounded-md flex flex-col h-[45%] min-h-0"
            onClick={() => highInputRef.current?.focus()}
          >
            <p className="p-2 border-b font-medium">Need to do</p>
            <div className="flex-1 overflow-y-auto pl-5 pr-2">
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
                  placeholder="feed dog / 5 mins / pref am"
                  className="w-full"
                ></input>
              </form>
            </div>
          </div>

          <div
            className="outline rounded-md flex flex-col h-[45%] min-h-0"
            onClick={() => lowInputRef.current?.focus()}
          >
            <p className="p-2 border-b font-medium">Want to do</p>
            <div className="flex-1 overflow-y-auto pl-5 pr-2">
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
                  placeholder="do coloring book / 5 mins / pref am"
                  className="w-full"
                ></input>
              </form>
            </div>
          </div>
        </div>
        <div className="outline rounded-md h-full overflow-y-auto w-[70%] flex-1">
          <div>
            {status == "loading" ||
            isLoading ||
            (error &&
              error
                .toString()
                .includes("Cannot read properties of undefined")) ? (
              "Loading your calendars..."
            ) : status == "unauthenticated" || error ? (
              <div>
                <p>
                  There was an error fetching your calendar. Try logging out and
                  logging back in.
                </p>
                <SignOut />
              </div>
            ) : (
              <div>
                {calendarSubmit ? (
                  schedule ? (
                    <div className="flex flex-col gap-y-1">
                      {/* {schedule.map((item, idx) =>
                    <div key={idx}>
                        <p>Name: {item.name}</p>
                        <p>Start: {item.start}</p>
                        <p>End: {item.end}</p>
                    </div>)} */}
                      <div className="flex justify-between items-center mb-2">
                        <button
                          className="px-3 py-1 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 flex items-center"
                          onClick={() => {
                            setCalendarSubmit(false);
                            setSchedule(null);
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 mr-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 19l-7-7 7-7"
                            />
                          </svg>
                          Back to calendars
                        </button>
                      </div>
                      <CalendarView
                        events={schedule}
                        tasks={[]}
                        start="07:00"
                        end="22:00"
                        height={90}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-4">
                        <button
                          className="px-3 py-1 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 flex items-center"
                          onClick={() => setCalendarSubmit(false)}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 mr-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 19l-7-7 7-7"
                            />
                          </svg>
                          Back to calendars
                        </button>
                      </div>
                      <div className="p-2">
                        {events &&
                          events.map((item, idx) => (
                            <div key={idx} className="mb-2 p-2 border rounded">
                              <p className="font-medium">{item.name}</p>
                              <p>
                                Time: {item.start} to {item.end}
                              </p>
                            </div>
                          ))}
                      </div>
                    </>
                  )
                ) : (
                  <>
                    <p>
                      Here are all the calendars we found associated with your
                      account. Please select the ones you would like us to
                      reference while making your schedule.
                    </p>
                    <div className="flex flex-wrap gap-2 my-2">
                      {selectedCalNames.length > 0 ? (
                        selectedCalNames.map((name, idx) => (
                          <div
                            key={idx}
                            className="flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                          >
                            <span>{name}</span>
                            <button
                              className="ml-2 text-blue-500 hover:text-blue-700 focus:outline-none"
                              onClick={() =>
                                updateSelectedCals(selectedCals[idx], name)
                              }
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500 text-sm italic">
                          No calendars selected
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col border rounded">
                      {calendars.map((item, idx) => (
                        <button
                          key={idx}
                          className={`text-left py-1 px-2 hover:bg-slate-100 ${
                            selectedCals.includes(item.id) ? "text-red-500" : ""
                          }`}
                          onClick={() =>
                            updateSelectedCals(item.id, item.summary)
                          }
                        >
                          {item.summary}
                        </button>
                      ))}
                    </div>
                    <button
                      className="mt-2 px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                      onClick={() => handleCalendarSubmit()}
                    >
                      Get events
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {calendarSubmit && (
            <button type="button" onClick={(e) => generateSchedule(e)}>
              make schedule
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function getListElementFromTask(
  task: Task,
  id: number,
  taskList: Task[],
  setTaskList: React.Dispatch<React.SetStateAction<Task[]>>
) {
  function deleteTask(id: number) {
    taskList.splice(id, 1);
    setTaskList([...taskList]);
  }

  return (
    <div
      className="group flex justify-between my-1 hover:bg-slate-200 p-1 rounded-sm"
      key={id}
    >
      <div className="flex gap-x-2">
        <p>{task.name}</p>
        <Badge>{task.getTimeText()}</Badge>
        {task.pref && <Badge className="button">pref {task.pref}</Badge>}
      </div>
      <button
        className="hidden group-hover:block"
        onClick={() => deleteTask(id)}
      >
        delete
      </button>
    </div>
  );
}

function compareStart(
  elem1: CalendarEvent | ScheduledTask,
  elem2: CalendarEvent | ScheduledTask
) {
  return compareISOTime(elem1.start, elem2.start);
}
