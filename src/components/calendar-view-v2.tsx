"use client"

import { CalendarEvent, ScheduledTask, Task } from "@/app/scheduler/classes";
import { addMinutesToISO, getTimeBetweenISO, compareISOTime } from "@/app/scheduler/makeSchedule.ts"

var range = (start : number, stop : number, step=1) => {
    const length = Math.ceil((stop - start) / step);
    return Array.from({length}, (_, i) => (i * step) + start);
}


export default function CalendarView(
    {events, tasks, start, end, height} :
    {events: CalendarEvent[], tasks: Task[], start : string, end : string, height : number}) {
    // Treating height as a vh 
    const rows = Math.ceil(getTimeBetweenISO(start, end) / 60);
    const rowH = height / rows;
    // Want one row for every hour

    return (
        <div className="" 
            style={{
                height: height.toString() + "vh",
                display: "grid",
                "gridTemplateColumns": "50px auto"
            }}>
            {/* Layout background of  */}
            {range(0, rows).map((rowI) => 
            <>
            <div style={
                {"gridRowStart": rowI+1, 
                "gridRowEnd": rowI+2, 
                "gridColumn": 1, 
                height: rowH.toString() + "vh",
                width: "30px",
                }}>
                <p>{addMinutesToISO(start, (rowI)*60)}</p>
            </div>
            <div  style={{"gridRowStart": rowI+1, "gridRowEnd": rowI+2, "gridColumn": 2, "borderBottom": "1px solid black","borderTop": "1px solid black"}}>
            </div>
            </>)}
            {events.map((item, id) => getTimeBlockDiv(item, start, rows, rowH))}
            {/* <div style={{"gri dColumnStart": 2, "gridRowStart": 8, "gridRowEnd": 11, "backgroundColor": "black", "opacity": .6, "marginTop": "2vh", "marginBottom": "2vh"}}>
                i span a few columns
            </div> */}
        </div>
    )
}

function getIdxAndOffset(isEnd : boolean, eventStart : string, dayStart : string, numRows : number, rowH : number) : [number, string] {
    const minutesBetween = getTimeBetweenISO(dayStart, eventStart);
    let hours = Math.floor(minutesBetween / 60); // grids are 1-indexed
    const minutes = minutesBetween - hours*60;
    hours++;
    if (minutes == 0) return [hours, "0"]
    if (isEnd) {
        // round up rowIdx
        const rowIdx = hours + 1;
        const marginPercent = (60 - minutes) / 60;
        const marginString = (marginPercent * rowH).toFixed(10) + "vh";
        return [rowIdx, marginString];
    } else {
        // round down rowIdx
        // const rowIdx = hours ;
        const marginPercent = minutes / 60;
        const marginString = (marginPercent * rowH).toFixed(10) + "vh";
        return [hours, marginString];
    }
}

function getTimeBlockDiv(event : CalendarEvent|ScheduledTask, start : string, rows : number, rowH: number) {
    if (compareISOTime(event.end, start) <= 0) return <></>
    let rowStart, startOffset;
    if (compareISOTime(event.start, start) < 0) {
        const [rS, sO] = [1, "0px"];
        rowStart = rS;
        startOffset = sO;
    } else {
        const [rS, sO] = getIdxAndOffset(false, event.start, start, rows, rowH)
        rowStart = rS;
        startOffset = sO;
    }
    const [rowEnd, endOffset] = getIdxAndOffset(true, event.end, start, rows, rowH)
    const style = {"gridColumnStart": 2, 
        "gridRowStart": rowStart, 
        "gridRowEnd": rowEnd, 
        "backgroundColor": "pink", 
        "marginTop": startOffset, 
        "marginBottom": endOffset,
        "fontSize": "12px",
        "border": "1px solid black",
        "borderRadius": "5px",
        "overflow": "hidden",
        }
    if (event instanceof ScheduledTask) {
        style["backgroundColor"] = "lightBlue";
    }
    return (
        <div style={style
            }>
            <p>{event.name}, {event.start}, {event.end}</p>
            
        </div>
    )
}