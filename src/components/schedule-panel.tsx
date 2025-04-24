"use client"

import { getIdsAndNames } from "@/app/api/calendar/get-ids-and-names";
import { useSession } from "next-auth/react";
import useSWR from 'swr';
import CalendarSelectionForm from "./calendar-selection";
import SignOut from "./sign-out";


export default function SchedulePanel() {

    // const events = await authorizeAndListEvents();
    // console.log(events);

    const { data: session, status} = useSession();

    const { data: calendars, error, isLoading } = useSWR("bazooka", (any) => getIdsAndNames(session.accessToken));

    console.log(calendars, isLoading, status);



    return (
        <div>
           {status == "loading" || isLoading ? "Loading your calendars..." :
                status == "unauthenticated" || error ? <div>
                <p>There was an error fetching your calendar. Try logging out and logging back in.</p>
                <SignOut />
            </div> :
           <CalendarSelectionForm calendars={calendars}/>
           } 
        </div>
    )
}