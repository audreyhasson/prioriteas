"use client"

import { useEffect, useState } from "react";
import { getEvents } from "@/app/api/calendar/get-events"
import { useSession } from "next-auth/react";
import { CalendarEvent } from "@/app/scheduler/classes"

export default function CalendarSelectionForm({ calendars } : {
    calendars : {
        id: string;
        summary: string;
    }[]
}) {

    const [selectedCals, setSelectedCals] = useState<Array<string>>([]);
    const [calendarSubmit, setCalendarSubmit] = useState(false);
    const [events, setEvents] = useState<Array<CalendarEvent>>([]);
    const { data: session, update } = useSession() 

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

    return (
        <div>
            {calendarSubmit ? 
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
    )
}