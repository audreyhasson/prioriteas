"use client"
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
import { compareISOTime, makeSchedule } from "@/app/scheduler/makeSchedule.ts"
import CalendarView from "@/components/calendar-view-v2.tsx";


export default function Schedule() {

    const [highPriorityTasks, setHighPriorityTasks] = useState<Task[]>([])
    const [lowPriorityTasks, setLowPriorityTasks] = useState<Task[]>([])
    const [syntaxError, setSyntaxError] = useState("");
    const [selectedCals, setSelectedCals] = useState<Array<string>>([]);
    const [calendarSubmit, setCalendarSubmit] = useState(false);
    const [events, setEvents] = useState<Array<CalendarEvent>>([]);
    const [schedule, setSchedule] = useState<null|Array<CalendarEvent|ScheduledTask>>(null);
    const highInputRef = useRef();
    const lowInputRef = useRef();

    const { data: session, status} = useSession();
    const { data: calendars, error, isLoading } = useSWR("bazooka", (any) => getIdsAndNames(session.accessToken));

    console.log(`status: ${status}, error: ${error}, isLoading ${isLoading}, session ${session}`)
    function updateSelectedCals(id : string) {
        if (selectedCals.includes(id)) {
            const newList = selectedCals.filter((item : string) => item !== id);
            console.log("newlist", newList, id);
            setSelectedCals(newList);
            console.log("just set selected cals", selectedCals, "to newlist", newList)
        } else {
            setSelectedCals([...selectedCals, id]);
        }
    }

    async function handleCalendarSubmit() {
        // pass in selected Ids to get events api function
        if (session && session.accessToken) {
            const caughtEvents = await getEvents(session.accessToken, selectedCals);
            console.log("caught", caughtEvents);
            setCalendarSubmit(true);
            setEvents(caughtEvents);
        }
        
    }

    function addTask(event : React.FormEvent, taskList : Task[], setTaskList : React.Dispatch<React.SetStateAction<Task[]>>) {
        event.preventDefault();
        const rawText = event.target[0].value;
        const task = getTaskFromRawText(rawText);
        if (task) setTaskList([...taskList, task]);

        event.target.reset();
    }

    function getTaskFromRawText(rawText : string) : Task | null {
        // Parse name, time, and pref
        // Should be in form name / time / pref, send error otherwise
        // Times could be in many forms
        const tagList = rawText.split("/")
        if (tagList.length < 2) {
            setSyntaxError("Need to include a name and a time estimate, separated by a slash, with every task")
            return null;
        }
        const name = tagList[0].trim();
        const timeText = tagList[1].trim();
        const minutes = getMinutesFromRawText(timeText);
        if (!minutes) {
            setSyntaxError("The time expression doesn't include numbers")
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
        setSyntaxError("")
        // @ts-ignore
        return new Task(name, minutes, pref);
    }

    function getMinutesFromRawText(timeText : string) {
        // if there are hours, get the hours
        let hours = 0
        const hIdx = timeText.indexOf("h")
        if (hIdx != -1) {
            const hourRawText = timeText.slice(0, hIdx);
            hours = parseInt(hourRawText.trim());
            if (Number.isNaN(hours)) {
                return null
            }
            timeText = timeText.slice(hIdx);
        }
        // Get to the next space or number
        while (timeText.length > 0 && /[A-Za-z]/.test(timeText[0])) {
            timeText = timeText.slice(1);
        }
        let minutes = 0
        const mIdx = timeText.indexOf("m")
        if (mIdx != -1) {
            const minRawText = timeText.slice(0, mIdx);
            minutes = parseInt(minRawText.trim());
            if (Number.isNaN(minutes)) {
                return null
            }
        }
        return hours*60 + minutes;
    }

    function generateSchedule(e : React.FormEvent) {
        e.preventDefault();
        // Making copies of tasks to send into schedule maker
        const highCopy = JSON.parse(JSON.stringify(highPriorityTasks));
        const lowCopy = JSON.parse(JSON.stringify(lowPriorityTasks));
        const scheduledTasks = (makeSchedule(highCopy, lowCopy, events, "07:00", "22:00"))
        console.log("just made", scheduledTasks)
        // Merge tasks and events into list sorted by time
        const tasksAndEvents = [...scheduledTasks, ...events];
        tasksAndEvents.sort(compareStart);
        setSchedule(tasksAndEvents)
    }

    return (
        <>
        <div className="flex h-[100vh] gap-x-5 p-8">
            <div className="w-2/3 gap-y-5 flex flex-col h-full">
                <p>Prioriteas</p>
                {syntaxError != "" &&  <p>Typing issue: {syntaxError}</p>}
                <div className="outline rounded-md h-1/2" onClick={() => highInputRef.current.focus()}> 
                    <p>Need to do</p>
                    <div className="pl-5">
                    {highPriorityTasks.map((task,id) => getListElementFromTask(task, id, highPriorityTasks, setHighPriorityTasks)
                    )}
                    <form className="w-full"onSubmit={(e) => addTask(e, highPriorityTasks, setHighPriorityTasks)}>
                        <input ref={highInputRef} type="text" placeholder="feed dog / 5 mins / pref am" className="w-full"></input>
                    </form>
                    </div>
                    
                    
                </div>
                <div className="outline rounded-md h-1/2" onClick={() => lowInputRef.current.focus()}>
                    <p>Want to do</p>
                    <div className="pl-5">
                    {lowPriorityTasks.map((task,id) => getListElementFromTask(task, id, lowPriorityTasks, setLowPriorityTasks)
                    )}
                    <form className="w-full"onSubmit={(e) => addTask(e, lowPriorityTasks, setLowPriorityTasks)}>
                        <input ref={lowInputRef} type="text" placeholder="do coloring book / 5 mins / pref am" className="w-full"></input>
                    </form>
                    </div>
                </div>
            </div>
            <div className="outline rounded-md h-full">
            <div>
           {status == "loading" || isLoading || (error && error.toString().includes("Cannot read properties of undefined"))? "Loading your calendars..." :
                status == "unauthenticated" || error ? <div>
                <p>There was an error fetching your calendar. Try logging out and logging back in.</p>
                <SignOut />
            </div> :
           <div>
           {calendarSubmit ? 
                schedule ? 
                <div className = "flex flex-col gap-y-1">
                    {/* {schedule.map((item, idx) =>
                    <div key={idx}>
                        <p>Name: {item.name}</p>
                        <p>Start: {item.start}</p>
                        <p>End: {item.end}</p>
                    </div>)} */}
                    <CalendarView
                    events={schedule} 
                    tasks={[]}
                    start="07:00" end="22:00" height={90}/>
                </div>
                :
               <>
               <p>Cool, you submitted something</p>
               {events && events.map((item, idx) => 
               <div key={idx}>
                   <p >Event: {item.name}</p>
                   <p>Time: {item.start} to {item.end}</p>
               </div> )}
               </>
           : <><p>Here are all the calendars we found associated with your account. Please select the ones you would like us to reference while making your schedule.</p>
           <p>Selected: {selectedCals}</p>
           <div className="flex flex-col">
               {calendars.map((item, idx) =>
                   <button key={idx} onClick={() => updateSelectedCals(item.id)}
                   className={selectedCals.includes(item.id) ? "text-green" : "text-gray"}>{item.summary}</button>
               )}
           </div>
           <button onClick={() => handleCalendarSubmit()}>get events from these calendars</button></>}
       </div>
           } 
        </div>
                {calendarSubmit && <button type="button" onClick={(e) => generateSchedule(e)}>make schedule</button>}
            </div>
            
        </div>
        </>
    )
}

function getListElementFromTask(task : Task, id : number, taskList : Task[], setTaskList : React.Dispatch<React.SetStateAction<Task[]>>) {
    
    function deleteTask(id : number) {
        taskList.splice(id, 1);
        setTaskList([...taskList]);
    }


    return (
    <div className="group flex justify-between my-1 hover:bg-slate-200 p-1 rounded-sm" key={id}>
        <div className="flex gap-x-2">
                    <p>{task.name}</p>
                <Badge>{task.getTimeText()}</Badge>
                {task.pref && <Badge className="button">pref {task.pref}</Badge>}
        </div>
        <button className="hidden group-hover:block" onClick={() => deleteTask(id)}>delete</button>
    </div>
    )
}

function compareStart(elem1 : CalendarEvent | ScheduledTask, elem2: CalendarEvent | ScheduledTask) {
    return compareISOTime(elem1.start, elem2.start);
}