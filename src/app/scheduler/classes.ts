export class Task {
  name: string;
  minutes: number;
  unbreakable: boolean;
  pref: string | null;
  constructor(name: string, minutes: number, unbreakable = false, pref = null) {
    this.name = name;
    this.minutes = minutes;
    this.unbreakable = unbreakable;
    this.pref = pref;
  }

  getTimeText() {
    const hours = Math.floor(this.minutes / 60);
    const minutes = this.minutes - hours * 60;
    let timeText = "";
    if (hours > 0) {
      if (hours == 1) {
        timeText = timeText.concat("1 hr");
      } else {
        timeText = timeText.concat(`${hours} hrs`);
      }
    }
    if (minutes > 0) {
      if (minutes == 1) {
        timeText = timeText.concat(" 1 min");
      } else {
        timeText = timeText.concat(` ${minutes} mins`);
      }
    }
    return timeText;
  }

  toRawText() {
    return `${this.name} / ${this.getTimeText()}${
      this.pref ? ` / pref ${this.pref}` : ""
    }`;
  }
}

export class ScheduledTask extends Task {
  start: string;
  end: string;
  constructor(
    name: string,
    minutes: number,
    start: string,
    end: string,
    pref = null
  ) {
    super(name, minutes, pref);
    this.start = start;
    this.end = end;
  }
}

export class CalendarEvent {
  name: string;
  start: string;
  end: string;
  constructor(name: string, start: string, end: string) {
    this.name = name;
    this.start = start;
    this.end = end;
  }
}

export interface Block {
  startTime: string;
  endTime: string;
  totalDuration: number;
  am: number;
  pm: number;
  eve: number;
}
