"use client"
import React, { Component } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";

// import "./App.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

class App extends Component {
  state = {
    events: [
      {
        start: new Date(), //moment().toDate(),
        end: new Date().setHours(20, 0, 0, 0), //moment().add(1, "days"),
        title: "Wennie Teams Link",
        id: "uniqueId"
      },
      {
        start: new Date(), //moment().toDate(),
        end: new Date().setHours(20, 0, 0, 0), //moment().add(1, "days"),
        title: "Wennie Teams Link2",
        id: "uniqueId2"
      }
    ]
  };

  onEventResize = (data) => {
    const { start, end } = data;

    this.setState((state) => {
        const idx = getEventIdx(state.events, data.event.id);
        if (idx == null) throw new Error ("That event doesn't exist");
        state.events[idx].start = start;
        state.events[idx].end = end;
        return { events: [...state.events] };
    });
  };

  onEventDrop = (data) => {
    console.log(data);
  };

  render() {
    return (
      <div className="App">
        <DnDCalendar
          defaultDate={moment().toDate()}
          defaultView="day"
          events={this.state.events}
          localizer={localizer}
          onEventDrop={this.onEventResize}
          onEventResize={this.onEventResize}
          resizable
          style={{ height: "80vh", width: "50vw" }}
        />
      </div>
    );
  }
}

function getEventIdx(eventList, id) {
    for (let i = 0; i < eventList.length; i++) {
        if (eventList[i].id === id) return i;
    }
    return null;
}

export default App;