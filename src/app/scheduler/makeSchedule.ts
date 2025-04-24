import { Task, CalendarEvent, ScheduledTask, Block } from "./classes";

const AM = "12:00";
const PM = "19:00";
const EVE = "23:59";

/**
 * @input A list of high priority tasks, a list of low priority tasks, a list of calendar events, and a start and end time
 * @output A list of scheduled tasks such that
 *      - each scheduled task corresponds to one task in the input task lists
 *      - the duration is the same or split over multiple scheduled tasks to sum to the original duration
 *      - no scheduled task overlaps with another or overlaps with any calendar event
 *      - all high priority tasks are present
 *
 * Invalid inputs err with a message (i.e., there is too little time in the day for the sum of the durations of tasks)
 *
 * The algorithm should prefer to output:
 *      - tasks which are divided into the fewest chunks
 *      - the maximum number of low priority tasks included in the schedule
 *      - the maximum number "prefs" are abided by
 */

export function makeSchedule(
  highPriorityTasks: Task[],
  lowPriorityTasks: Task[],
  events: CalendarEvent[],
  startOfDay: string,
  endOfDay: string
) {
  const [freeBlocks, freeTime] = getFreeBlocksFromEvents(
    events,
    startOfDay,
    endOfDay
  );
  const totalTaskTime = countTaskTime(highPriorityTasks);
  // Reject invalid input
  if (totalTaskTime > freeTime) {
    throw new Error(
      `Not enough time in the day, ${freeTime} free minutes and ${totalTaskTime} minutes of tasks`
    );
  }

  // Sort free blocks by duration
  freeBlocks.sort(compareBlockDuration);
  // Sort high priority tasks first by if they have a pref then duration (asc)
  //   const sortedHighTasks = sortByPrefThenDuration(highPriorityTasks);
  highPriorityTasks.sort(comparePrefThenDuration);

  const scheduledTasks: ScheduledTask[] = [];

  while (highPriorityTasks.length > 0) {
    const nextTask = highPriorityTasks.pop();
    if (!nextTask) throw new Error("While loop guard violated");
    scheduleArbTaskFromList(
      nextTask,
      scheduledTasks,
      freeBlocks,
      startOfDay,
      endOfDay,
      highPriorityTasks
    );
  }

  // TODO: Add in as many low priority tasks as you can
  lowPriorityTasks.sort(comparePrefThenDuration);
  let lowFreeTime = getFreeTime(freeBlocks);
  while (
    lowPriorityTasks.length > 0 &&
    lowFreeTime >= lowPriorityTasks[0].minutes
  ) {
    // While there's time to schedule at least one task, do it
    // Schedule the biggest task you can
    // Find the next task we can schedule
    while (
      lowFreeTime < lowPriorityTasks[lowPriorityTasks.length - 1].minutes
    ) {
      lowPriorityTasks.pop(); // remove unschedulable elements
    }
    // Now the first element in the list is schedulable
    let nextTask = lowPriorityTasks.pop();
    if (!nextTask) throw new Error("Should have guaranteed array nonempty");

    const res = scheduleArbTaskFromList(
      nextTask,
      scheduledTasks,
      freeBlocks,
      startOfDay,
      endOfDay,
      lowPriorityTasks
    );
    if (res) lowFreeTime = getFreeTime(freeBlocks);
    if (lowFreeTime == 0) break;
  }

  return scheduledTasks;
}

function scheduleArbTaskFromList(
  nextTask: Task,
  scheduledTasks: ScheduledTask[],
  freeBlocks: Block[],
  startOfDay: string,
  endOfDay: string,
  unscheduledList: Task[]
) {
  if (nextTask.pref) {
    // Helper returns "null" if there is no way to honor pref.
    // If it can honor pref, helper mutates freeBlocks to account for removing the block of time
    // that was used to schedule the task
    // Returns list of tasks (since task may have been split into multiple chunks)
    const possiblyScheduledTaskChunks = scheduleTaskWithPref(
      nextTask,
      nextTask.pref,
      freeBlocks,
      startOfDay,
      endOfDay
    );
    if (possiblyScheduledTaskChunks) {
      scheduledTasks.push(...possiblyScheduledTaskChunks);
      return 1;
    } else {
      // Otherwise, it was not scheduled and we can't honor pref
      nextTask.pref = null;
      // Reinsert it into the sorted list without a pref
      insertElemIntoSortedList(
        nextTask,
        unscheduledList,
        comparePrefThenDuration
      );
      return 0;
    }
  } else {
    const scheduledTaskChunks = scheduleTask(nextTask, freeBlocks);
    scheduledTasks.push(...scheduledTaskChunks);
    return 1;
  }
}

function getFreeTime(freeBlocks: Block[]) {
  return freeBlocks.reduce((time, block) => time + block.totalDuration, 0);
}

function countTaskTime(tasks: Task[]) {
  return tasks.reduce((time, task) => time + task.minutes, 0);
}

function scheduleTask(task: Task, freeBlocks: Block[]) {
  const blockIdxs = matchTaskWithBlockIdxs(
    freeBlocks.map((item, idx) => idx),
    freeBlocks,
    task,
    "totalDuration"
  );
  const scheduledTaskChunks = [];
  // Otherwise we found multiple blocks we want to insert our task into
  // We should remove that block from freeBlocks, chop out the time we need,
  // and then add back the unused parts of the block
  console.log("want to add all these blocks from list", blockIdxs, freeBlocks);

  // Take out the blocks i want and add them to their own list
  const blocksIWant = [];
  for (let j = blockIdxs.length - 1; j > -1; j--) {
    blocksIWant.push(freeBlocks[blockIdxs[j]]);
    freeBlocks.splice(blockIdxs[j], 1);
  } //TODO: ADD SAME THING TO PREF

  for (let j = 0; j < blocksIWant.length; j++) {
    const block = blocksIWant[j];
    const [scheduledTaskChunk, newBlocks] = scheduleTaskWithBlock(task, block);
    // Take time out of unscheduled task
    task.minutes = task.minutes - scheduledTaskChunk.minutes;
    scheduledTaskChunks.push(scheduledTaskChunk);
    for (let i = 0; i < newBlocks.length; i++) {
      insertElemIntoSortedList(newBlocks[i], freeBlocks, compareBlockDuration);
    }
  }

  return scheduledTaskChunks;
}

function scheduleTaskWithBlock(
  task: Task,
  block: Block
): [ScheduledTask, Block[]] {
  const start = block.startTime;
  const minutes = Math.min(block.totalDuration, task.minutes);
  const end = addMinutesToISO(start, minutes);
  const scheduledTask = new ScheduledTask(task.name, minutes, start, end);

  // Make new blocks
  const newBlocks = [];
  // Check for block at end of task
  if (compareISOTime(end, block.endTime) < 0) {
    newBlocks.push(getFreeBlockFromStartEnd(end, block.endTime));
  }

  return [scheduledTask, newBlocks];
}

// Helper returns "null" if there is no way to honor pref.
// If it can honor pref, helper mutates freeBlocks to account for removing the block of time
// that was used to schedule the task
// Returns list of tasks (since task may have been split into multiple chunks)
function scheduleTaskWithPref(
  task: Task,
  pref: string,
  freeBlocks: Block[],
  startOfDay: string,
  endOfDay: string
) {
  const prefBlockIdxs = getFreeBlockWithPrefIdxs(pref, freeBlocks);
  if (
    prefBlockIdxs.reduce(
      // @ts-ignore
      (time: number, idx: number) => time + freeBlocks[idx][pref],
      0
    ) < task.minutes
  ) {
    return null; // if there's not enough time in this zone, we can't honor pref
  }
  const blockIdxs = matchTaskWithBlockIdxs(
    prefBlockIdxs,
    freeBlocks,
    task,
    pref
  );
  if (!blockIdxs) return null;
  blockIdxs.sort();

  // Take out the blocks i want and add them to their own list
  const blocksIWant = [];
  for (let j = blockIdxs.length - 1; j > -1; j--) {
    blocksIWant.push(freeBlocks[blockIdxs[j]]);
    freeBlocks.splice(blockIdxs[j], 1);
  } //TODO: ADD SAME THING TO PREF
  const scheduledTaskChunks = [];
  // Otherwise we found multiple blocks we want to insert our task into
  // We should remove that block from freeBlocks, chop out the time we need,
  // and then add back the unused parts of the block
  // Make sure we start at "pref" time!
  for (let j = 0; j < blocksIWant.length; j++) {
    const block = blocksIWant[j];
    const [scheduledTaskChunk, newBlocks] = scheduleTaskWithBlockFromPref(
      task,
      block,
      pref,
      startOfDay,
      endOfDay
    );
    // Take time out of unscheduled task
    task.minutes = task.minutes - scheduledTaskChunk.minutes;
    scheduledTaskChunks.push(scheduledTaskChunk);
    for (let i = 0; i < newBlocks.length; i++) {
      insertElemIntoSortedList(newBlocks[i], freeBlocks, compareBlockDuration);
    }
  }

  return scheduledTaskChunks;
}

function scheduleTaskWithBlockFromPref(
  task: Task,
  block: Block,
  pref: string,
  startOfDay: string,
  endOfDay: string
): [ScheduledTask, Block[]] {
  // only returns 1 scheduled task, may return multiple blocks
  // make sure you return the block from before the pref time !! and perhaps after
  // scheduled task == (name: string, minutes: number, start: string, end: string)

  // Start time of task is the max between the pref start time and the block start time
  const [prefStart, prefEnd] = getStartAndEndFromPref(
    pref,
    startOfDay,
    endOfDay
  );
  const start =
    compareISOTime(prefStart, block.startTime) > 0
      ? prefStart
      : block.startTime;
  // @ts-ignore
  const minutes = Math.min(block[pref], task.minutes);
  const end = addMinutesToISO(start, minutes);
  const scheduledTask = new ScheduledTask(
    task.name,
    minutes,
    start,
    end,
    //@ts-ignore
    task.pref
  );

  // Make new blocks
  const newBlocks = [];
  // Check for block in front of task
  if (compareISOTime(block.startTime, start) < 0) {
    newBlocks.push(getFreeBlockFromStartEnd(block.startTime, start));
  }
  if (compareISOTime(end, block.endTime) < 0) {
    newBlocks.push(getFreeBlockFromStartEnd(end, block.endTime));
  }

  return [scheduledTask, newBlocks];
}

export function addMinutesToISO(iso: string, minutesToAdd: number) {
  const [isoHours, isoMinutes] = [
    parseInt(iso.slice(0, 2)),
    parseInt(iso.slice(3)),
  ];
  const totalMinutes = isoHours * 60 + isoMinutes + minutesToAdd;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const strHours = hours < 10 ? `0${hours}` : `${hours}`;
  const strMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${strHours}:${strMinutes}`;
}

function getStartAndEndFromPref(
  pref: string,
  startOfDay: string,
  endOfDay: string
): [string, string] {
  switch (pref) {
    case "am":
      return [startOfDay, AM];
    case "pm":
      return [AM, PM];
    default: // else
      return [PM, endOfDay];
  }
}

function matchTaskWithBlockIdxs(
  prefIdxs: number[],
  freeBlocks: Block[],
  task: Task,
  pref: string
) {
  // Loop through idxs and see if there is a tightest fit one
  // Otherwise, i have to split it up, take the largest block and then loop again
  const res = [];
  let minutes = task.minutes;
  while (minutes > 0) {
    const temp = minutes;
    // Loop and try to find a block
    // let blockIdx;
    for (let i = 0; i < prefIdxs.length; i++) {
      // I want to return the one just bigger than the first too small one
      const idx = prefIdxs[i];
      const block = freeBlocks[idx];
      // @ts-ignore
      const blockPrefTime = block[pref];
      if (task.minutes > blockPrefTime) {
        // First too small one!
        if (i > 0) {
          // We are done! We can add this block and return
          res.push(prefIdxs[i - 1]);
          return res;
        } else {
          // We need another chunk, all of these are too small
          res.push(idx); // i want this chunk, it's the biggest available
          prefIdxs.splice(i, 1); // take this chunk out of contention
          minutes = minutes - blockPrefTime; // Now i'm looking for the rest of the time
          break; // break the for loop and do another loop of the while
        }
      } else if (i == prefIdxs.length - 1) {
        // All of them are big enough, we return the smallest one and be done
        res.push(prefIdxs[i]);
        return res;
      }
    }
    if (temp == minutes) {
      // we went through all of the blocks and didn't get any closer to the goal
      throw new Error("Supposed to have enough blocks");
    }
  }
  // res should have been returned already, but just in case
  return res;
}

function getFreeBlockWithPrefIdxs(pref: string, freeBlocks: Block[]) {
  const enumBlocks: [number, Block][] = freeBlocks.map((item, idx) => [
    idx,
    item,
  ]);
  const idxsAndDurations: [number, number][] = [];
  // Maintain sortedness of res the whole time
  for (let i = 0; i < enumBlocks.length; i++) {
    const [idx, block] = enumBlocks[i];
    // @ts-ignore
    const prefTime = block[pref];
    if (prefTime > 0)
      insertElemIntoSortedList(
        [idx, prefTime],
        idxsAndDurations,
        comparePrefDuration
      );
  }
  return idxsAndDurations.map(([idx, _]) => idx);
}

function insertElemIntoSortedList<T>(
  elemToSort: T,
  sortedList: Array<T>,
  compareFn: (a: T, b: T) => number
) {
  for (let i = 0; i < sortedList.length; i++) {
    const currElem = sortedList[i];
    const ord = compareFn(elemToSort, currElem);
    if (ord <= 0) {
      sortedList.splice(i, 0, elemToSort);
      return;
    }
  }
  // It's gotta be at the end
  sortedList.push(elemToSort);
}

function comparePrefDuration(a: [number, number], b: [number, number]) {
  return b[1] - a[1];
}

function getFreeBlocksFromEvents(
  calEvents: CalendarEvent[],
  startOfDay: string,
  endOfDay: string
): [Block[], number] {
  const freeBlocks = [];
  let freeTime = 0;
  calEvents.sort(calCompareFn);

  let start = startOfDay;

  for (let i = 0; i < calEvents.length; i++) {
    const event = calEvents[i];
    if (compareISOTime(start, event.start) < 0) {
      // add free block from start to event start
      const newBlock = getFreeBlockFromStartEnd(start, event.start);
      freeBlocks.push(newBlock);
      freeTime = freeTime + newBlock.totalDuration;
    }
    start = event.end;
  }
  const lastBlock = getFreeBlockFromStartEnd(start, endOfDay);
  freeBlocks.push(lastBlock);
  freeTime = freeTime + lastBlock.totalDuration;
  return [freeBlocks, freeTime];
}

function calCompareFn(event1: CalendarEvent, event2: CalendarEvent) {
  return compareISOTime(event1.start, event2.start);
}

function compareBlockDuration(block1: Block, block2: Block) {
  return block2.totalDuration - block1.totalDuration;
}

function comparePrefThenDuration(task1: Task, task2: Task) {
  if (task1.pref && task2.pref) return task1.minutes - task2.minutes;
  if (task1.pref && !task2.pref) return 1;
  if (task2.pref && !task1.pref) return -1;
  return task1.minutes - task2.minutes;
}

export function compareISOTime(time1: string, time2: string) {
  if (time1 == time2) return 0;
  // format 00:00 / 23:59
  const [hours1, minutes1] = [
    parseInt(time1.slice(0, 2)),
    parseInt(time1.slice(3)),
  ];
  const [hours2, minutes2] = [
    parseInt(time2.slice(0, 2)),
    parseInt(time2.slice(3)),
  ];
  if (hours1 < hours2) return -1;
  else if (hours1 > hours2) return 1;
  else {
    // hours are the same
    if (minutes1 < minutes2) return -1;
    return 1;
  }
}

function getFreeBlockFromStartEnd(start: string, end: string) {
  // get time returns 0 if it would be negative
  const totalDuration = getTimeBetweenISO(start, end);
  const am = Math.max(
    getTimeBetweenISO(start, AM) - getTimeBetweenISO(end, AM),
    0
  );
  const pm = Math.max(
    getTimeBetweenISO(AM, PM) -
      getTimeBetweenISO(end, PM) -
      getTimeBetweenISO(AM, start),
    0
  );
  const eve = Math.max(
    getTimeBetweenISO(PM, EVE) -
      getTimeBetweenISO(end, EVE) -
      getTimeBetweenISO(PM, start),
    0
  );
  return {
    startTime: start,
    endTime: end,
    totalDuration: totalDuration,
    am: am,
    pm: pm,
    eve: eve,
  };
}

export function getTimeBetweenISO(start: string, end: string) {
  const ord = compareISOTime(start, end);
  if (ord >= 0) return 0;
  // Now we know the start time is before the end time
  const [hours1, minutes1] = [
    parseInt(start.slice(0, 2)),
    parseInt(start.slice(3)),
  ];
  const [hours2, minutes2] = [
    parseInt(end.slice(0, 2)),
    parseInt(end.slice(3)),
  ];

  return hours2 * 60 + minutes2 - (hours1 * 60 + minutes1);
}

/** TESTING */
// @ts-ignore
const plHw = new Task("312 homework", 120, "am");
const grading = new Task("grade resubs", 30);
// @ts-ignore
const journal = new Task("journal", 15, "pm");
const bmeQuiz = new Task("bme quiz :(", 120);

const testHighTasks = [plHw, grading, journal, bmeQuiz];

const goGym = new Task("go to gym", 120);
const seeKev = new Task("see kev", 30);
const rockClimb = new Task("Rock climbing", 120, "pm");
const dinnerWithGirls = new Task("women in din", 120, "eve");

const testLowTasks = [goGym, seeKev, rockClimb, dinnerWithGirls];

const lecture1 = new CalendarEvent("210 Lecture", "09:00", "10:50");
const lecture2 = new CalendarEvent("312 Lecture", "12:30", "13:50");
const soccer = new CalendarEvent("Soccer practice", "16:00", "20:00");

const testEvents = [lecture1, lecture2, soccer];

console.log(
  "Final result",
  makeSchedule(testHighTasks, testLowTasks, testEvents, "07:00", "22:00")
);
