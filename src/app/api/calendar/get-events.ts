import { CalendarEvent } from "@/app/scheduler/classes";
// Takes in a list of calendar ids and gets the events for today from those calendars

export async function getEvents(accessToken: string, calendarIds: string[]) {
  let allEvents: CalendarEvent[] = [];
  // Go through each calendar id and query for the day's events
  // Parse those events to get just summary, start, end (adjusted to today)
  const timeMinD = new Date();
  timeMinD.setHours(0, 0, 0, 0);
  const timeMaxD = new Date();
  timeMaxD.setHours(23, 59, 59, 999);
  const timeMin = timeMinD.toISOString();
  const timeMax = timeMaxD.toISOString();
  // "2024-10-9T04:00:00.000Z"; good busy day to test on
  // "2024-10-10T04:00:00.000Z";

  for (let i = 0; i < calendarIds.length; i++) {
    const id = calendarIds[i];
    let calEventResult;
    try {
      calEventResult = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${id}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true`,
        {
          method: "GET",
          headers: {
            Authorization: "Bearer " + accessToken,
          },
        }
      ).then((res) => res.json());
      console.log("RES", calEventResult);
      allEvents = [...allEvents, ...parseForTimeAndName(calEventResult.items)];
    } catch (err) {
      console.log(err);
      console.log("Couldn't add event for calendar ", id);
    }
  }

  return allEvents;
}

function parseForTimeAndName(calItems) {
  const timeMinD = new Date();
  const timeZero = new Date();
  timeMinD.setHours(0, 0, 0, 0);
  timeZero.setUTCHours(0, 0, 0, 0);
  console.log("og min", timeMinD.toISOString());
  const parsedResult = [];
  for (let i = 0; i < calItems.length; i++) {
    const { summary, start, end, status, attendees } = calItems[i];
    if (status == "cancelled" || attendees) continue;
    console.log(
      "it is",
      Date.parse(start.dateTime) < timeMinD.getTime(),
      "that this ev is too early",
      start.dateTime
    );
    if (Date.parse(start.dateTime) < timeMinD.getTime()) {
      console.log(start.dateTime, "is too early");

      start.dateTime = timeZero.toISOString();
      console.log("new", start.dateTime);
    }
    const parsedStart = getTrueTimeFromEventTime(start.dateTime);
    const parsedEnd = getTrueTimeFromEventTime(end.dateTime);
    const event = new CalendarEvent(summary, parsedStart, parsedEnd);
    parsedResult.push(event);
  }
  return parsedResult;
}

function getTrueTimeFromEventTime(isoDateString: string) {
  // Note : may change later to just be actual time to make schedule easier to display
  return isoDateString.slice(isoDateString.indexOf("T")).slice(1, 6);
}
