"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var classes_1 = require("./classes");
var AM = "12:00";
var PM = "19:00";
var EVE = "23:59";
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
function makeSchedule(highPriorityTasks, lowPriorityTasks, events, startOfDay, endOfDay) {
    var _a = getFreeBlocksFromEvents(events, startOfDay, endOfDay), freeBlocks = _a[0], freeTime = _a[1];
    var totalTaskTime = countTaskTime(highPriorityTasks);
    // Reject invalid input
    if (totalTaskTime > freeTime) {
        throw new Error("Not enough time in the day, ".concat(freeTime, " free minutes and ").concat(totalTaskTime, " minutes of tasks"));
    }
    // Sort free blocks by duration
    freeBlocks.sort(compareBlockDuration);
    console.log("sorted FREE BLOCKS", freeBlocks);
    // Sort high priority tasks first by if they have a pref then duration (asc)
    //   const sortedHighTasks = sortByPrefThenDuration(highPriorityTasks);
    highPriorityTasks.sort(comparePrefThenDuration);
    console.log("sorted TASKS", highPriorityTasks);
    var scheduledTasks = [];
    while (highPriorityTasks.length > 0) {
        var nextTask = highPriorityTasks.pop();
        if (!nextTask)
            throw new Error("While loop guard violated");
        scheduleArbTaskFromList(nextTask, scheduledTasks, freeBlocks, startOfDay, endOfDay, highPriorityTasks);
    }
    // TODO: Add in as many low priority tasks as you can
    lowPriorityTasks.sort(comparePrefThenDuration);
    console.log("ALL LOW PRI TAKSS", lowPriorityTasks);
    var lowFreeTime = getFreeTime(freeBlocks);
    while (lowPriorityTasks.length > 0 &&
        lowFreeTime >= lowPriorityTasks[0].minutes) {
        // console.log(`continuing because i have ${lowFreeTime} free time and the smallest task ahead
        //     is ${lowPriorityTasks[lowPriorityTasks.length - 1].minutes} minutes`);
        // While there's time to schedule at least one task, do it
        // Schedule the biggest task you can
        // Find the next task we can schedule
        while (lowFreeTime < lowPriorityTasks[lowPriorityTasks.length - 1].minutes) {
            lowPriorityTasks.pop(); // remove unschedulable elements
        }
        // Now the first element in the list is schedulable
        var nextTask = lowPriorityTasks.pop();
        if (!nextTask)
            throw new Error("Should have guaranteed array nonempty");
        console.log("trying to schedule", nextTask.name, "pretty sure i can");
        var res = scheduleArbTaskFromList(nextTask, scheduledTasks, freeBlocks, startOfDay, endOfDay, lowPriorityTasks);
        if (res)
            lowFreeTime = getFreeTime(freeBlocks);
        if (lowFreeTime == 0)
            break;
    }
    return scheduledTasks;
}
function scheduleArbTaskFromList(nextTask, scheduledTasks, freeBlocks, startOfDay, endOfDay, unscheduledList) {
    if (nextTask.pref) {
        // Helper returns "null" if there is no way to honor pref.
        // If it can honor pref, helper mutates freeBlocks to account for removing the block of time
        // that was used to schedule the task
        // Returns list of tasks (since task may have been split into multiple chunks)
        var possiblyScheduledTaskChunks = scheduleTaskWithPref(nextTask, nextTask.pref, freeBlocks, startOfDay, endOfDay);
        if (possiblyScheduledTaskChunks) {
            scheduledTasks.push.apply(scheduledTasks, possiblyScheduledTaskChunks);
            return 1;
        }
        else {
            // Otherwise, it was not scheduled and we can't honor pref
            nextTask.pref = null;
            // Reinsert it into the sorted list without a pref
            insertElemIntoSortedList(nextTask, unscheduledList, comparePrefThenDuration);
            console.log("SCHEDULED TASKS SO FAR:", scheduledTasks);
            return 0;
        }
    }
    else {
        var scheduledTaskChunks = scheduleTask(nextTask, freeBlocks);
        scheduledTasks.push.apply(scheduledTasks, scheduledTaskChunks);
        return 1;
    }
}
function getFreeTime(freeBlocks) {
    return freeBlocks.reduce(function (time, block) { return time + block.totalDuration; }, 0);
}
function countTaskTime(tasks) {
    return tasks.reduce(function (time, task) { return time + task.minutes; }, 0);
}
function scheduleTask(task, freeBlocks) {
    var blockIdxs = matchTaskWithBlockIdxs(freeBlocks.map(function (item, idx) { return idx; }), freeBlocks, task, "totalDuration");
    var scheduledTaskChunks = [];
    console.log("Found ids:", blockIdxs);
    // Otherwise we found multiple blocks we want to insert our task into
    // We should remove that block from freeBlocks, chop out the time we need,
    // and then add back the unused parts of the block
    // First, remove all the blocks and place them in their own list
    for (var j = 0; j < blockIdxs.length; j++) {
        var blockIdx = blockIdxs[j];
        var block = freeBlocks[blockIdx];
        // console.log(
        //   "in schedule task, block:",
        //   block,
        //   "\nfree:",
        //   freeBlocks,
        //   "\nblock idx:",
        //   blockIdx
        // );
        freeBlocks.splice(blockIdx, 1); // remove one item starting from blockIdx
        var _a = scheduleTaskWithBlock(task, block), scheduledTaskChunk = _a[0], newBlocks = _a[1];
        // Take time out of unscheduled task
        task.minutes = task.minutes - scheduledTaskChunk.minutes;
        scheduledTaskChunks.push(scheduledTaskChunk);
        for (var i = 0; i < newBlocks.length; i++) {
            insertElemIntoSortedList(newBlocks[i], freeBlocks, compareBlockDuration);
        }
    }
    return scheduledTaskChunks;
}
function scheduleTaskWithBlock(task, block) {
    var start = block.startTime;
    var minutes = Math.min(block.totalDuration, task.minutes);
    var end = addMinutesToISO(start, minutes);
    var scheduledTask = new classes_1.ScheduledTask(task.name, minutes, start, end);
    // Make new blocks
    var newBlocks = [];
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
function scheduleTaskWithPref(task, pref, freeBlocks, startOfDay, endOfDay) {
    var prefBlockIdxs = getFreeBlockWithPrefIdxs(pref, freeBlocks);
    if (prefBlockIdxs.reduce(
    // @ts-ignore
    function (time, idx) { return time + freeBlocks[idx][pref]; }, 0) < task.minutes) {
        return null; // if there's not enough time in this zone, we can't honor pref
    }
    var blockIdxs = matchTaskWithBlockIdxs(prefBlockIdxs, freeBlocks, task, pref);
    if (!blockIdxs)
        return null;
    var scheduledTaskChunks = [];
    // Otherwise we found multiple blocks we want to insert our task into
    // We should remove that block from freeBlocks, chop out the time we need,
    // and then add back the unused parts of the block
    // Make sure we start at "pref" time!
    for (var j = 0; j < blockIdxs.length; j++) {
        var blockIdx = blockIdxs[j];
        var block = freeBlocks[blockIdx];
        freeBlocks.splice(blockIdx, 1); // remove one item starting from blockIdx
        var _a = scheduleTaskWithBlockFromPref(task, block, pref, startOfDay, endOfDay), scheduledTaskChunk = _a[0], newBlocks = _a[1];
        // Take time out of unscheduled task
        task.minutes = task.minutes - scheduledTaskChunk.minutes;
        scheduledTaskChunks.push(scheduledTaskChunk);
        for (var i = 0; i < newBlocks.length; i++) {
            insertElemIntoSortedList(newBlocks[i], freeBlocks, compareBlockDuration);
        }
    }
    return scheduledTaskChunks;
}
function scheduleTaskWithBlockFromPref(task, block, pref, startOfDay, endOfDay) {
    // only returns 1 scheduled task, may return multiple blocks
    // make sure you return the block from before the pref time !! and perhaps after
    // scheduled task == (name: string, minutes: number, start: string, end: string)
    // Start time of task is the max between the pref start time and the block start time
    var _a = getStartAndEndFromPref(pref, startOfDay, endOfDay), prefStart = _a[0], prefEnd = _a[1];
    var start = compareISOTime(prefStart, block.startTime) > 0
        ? prefStart
        : block.startTime;
    // @ts-ignore
    var minutes = Math.min(block[pref], task.minutes);
    var end = addMinutesToISO(start, minutes);
    var scheduledTask = new classes_1.ScheduledTask(task.name, minutes, start, end, 
    //@ts-ignore
    task.pref);
    // Make new blocks
    var newBlocks = [];
    // Check for block in front of task
    if (compareISOTime(block.startTime, start) < 0) {
        newBlocks.push(getFreeBlockFromStartEnd(block.startTime, start));
    }
    if (compareISOTime(end, block.endTime) < 0) {
        newBlocks.push(getFreeBlockFromStartEnd(end, block.endTime));
    }
    return [scheduledTask, newBlocks];
}
function addMinutesToISO(iso, minutesToAdd) {
    var _a = [
        parseInt(iso.slice(0, 2)),
        parseInt(iso.slice(3)),
    ], isoHours = _a[0], isoMinutes = _a[1];
    var totalMinutes = isoHours * 60 + isoMinutes + minutesToAdd;
    var hours = Math.floor(totalMinutes / 60);
    var minutes = totalMinutes % 60;
    var strHours = hours < 10 ? "0".concat(hours) : "".concat(hours);
    var strMinutes = minutes < 10 ? "0".concat(minutes) : "".concat(minutes);
    return "".concat(strHours, ":").concat(strMinutes);
}
function getStartAndEndFromPref(pref, startOfDay, endOfDay) {
    switch (pref) {
        case "am":
            return [startOfDay, AM];
        case "pm":
            return [AM, PM];
        default: // else
            return [PM, endOfDay];
    }
}
function matchTaskWithBlockIdxs(prefIdxs, freeBlocks, task, pref) {
    // Loop through idxs and see if there is a tightest fit one
    // Otherwise, i have to split it up, take the largest block and then loop again
    var res = [];
    var minutes = task.minutes;
    while (minutes > 0) {
        var temp = minutes;
        // Loop and try to find a block
        // let blockIdx;
        for (var i = 0; i < prefIdxs.length; i++) {
            // I want to return the one just bigger than the first too small one
            var idx = prefIdxs[i];
            var block = freeBlocks[idx];
            // @ts-ignore
            var blockPrefTime = block[pref];
            if (task.minutes > blockPrefTime) {
                // First too small one!
                if (i > 0) {
                    // We are done! We can add this block and return
                    res.push(prefIdxs[i - 1]);
                    return res;
                }
                else {
                    // We need another chunk, all of these are too small
                    res.push(idx); // i want this chunk, it's the biggest available
                    prefIdxs.splice(i, 1); // take this chunk out of contention
                    minutes = minutes - blockPrefTime; // Now i'm looking for the rest of the time
                    break; // break the for loop and do another loop of the while
                }
            }
            else if (i == prefIdxs.length - 1) {
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
function getFreeBlockWithPrefIdxs(pref, freeBlocks) {
    var enumBlocks = freeBlocks.map(function (item, idx) { return [
        idx,
        item,
    ]; });
    var idxsAndDurations = [];
    // Maintain sortedness of res the whole time
    for (var i = 0; i < enumBlocks.length; i++) {
        var _a = enumBlocks[i], idx = _a[0], block = _a[1];
        // @ts-ignore
        var prefTime = block[pref];
        if (prefTime > 0)
            insertElemIntoSortedList([idx, prefTime], idxsAndDurations, comparePrefDuration);
    }
    return idxsAndDurations.map(function (_a) {
        var idx = _a[0], _ = _a[1];
        return idx;
    });
}
function insertElemIntoSortedList(elemToSort, sortedList, compareFn) {
    for (var i = 0; i < sortedList.length; i++) {
        var currElem = sortedList[i];
        var ord = compareFn(elemToSort, currElem);
        if (ord <= 0) {
            sortedList.splice(i, 0, elemToSort);
            return;
        }
    }
    // It's gotta be at the end
    sortedList.push(elemToSort);
}
function comparePrefDuration(a, b) {
    return b[1] - a[1];
}
function getFreeBlocksFromEvents(calEvents, startOfDay, endOfDay) {
    var freeBlocks = [];
    var freeTime = 0;
    calEvents.sort(calCompareFn);
    var start = startOfDay;
    for (var i = 0; i < calEvents.length; i++) {
        var event_1 = calEvents[i];
        if (compareISOTime(start, event_1.start) < 0) {
            // add free block from start to event start
            var newBlock = getFreeBlockFromStartEnd(start, event_1.start);
            freeBlocks.push(newBlock);
            freeTime = freeTime + newBlock.totalDuration;
        }
        start = event_1.end;
    }
    var lastBlock = getFreeBlockFromStartEnd(start, endOfDay);
    freeBlocks.push(lastBlock);
    freeTime = freeTime + lastBlock.totalDuration;
    return [freeBlocks, freeTime];
}
function calCompareFn(event1, event2) {
    return compareISOTime(event1.start, event2.start);
}
function compareBlockDuration(block1, block2) {
    return block2.totalDuration - block1.totalDuration;
}
function comparePrefThenDuration(task1, task2) {
    if (task1.pref && task2.pref)
        return task1.minutes - task2.minutes;
    if (task1.pref && !task2.pref)
        return 1;
    if (task2.pref && !task1.pref)
        return -1;
    return task1.minutes - task2.minutes;
}
function compareISOTime(time1, time2) {
    if (time1 == time2)
        return 0;
    // format 00:00 / 23:59
    var _a = [
        parseInt(time1.slice(0, 2)),
        parseInt(time1.slice(3)),
    ], hours1 = _a[0], minutes1 = _a[1];
    var _b = [
        parseInt(time2.slice(0, 2)),
        parseInt(time2.slice(3)),
    ], hours2 = _b[0], minutes2 = _b[1];
    if (hours1 < hours2)
        return -1;
    else if (hours1 > hours2)
        return 1;
    else {
        // hours are the same
        if (minutes1 < minutes2)
            return -1;
        return 1;
    }
}
function getFreeBlockFromStartEnd(start, end) {
    // get time returns 0 if it would be negative
    var totalDuration = getTimeBetweenISO(start, end);
    var am = Math.max(getTimeBetweenISO(start, AM) - getTimeBetweenISO(end, AM), 0);
    var pm = Math.max(getTimeBetweenISO(AM, PM) -
        getTimeBetweenISO(end, PM) -
        getTimeBetweenISO(AM, start), 0);
    var eve = Math.max(getTimeBetweenISO(PM, EVE) -
        getTimeBetweenISO(end, EVE) -
        getTimeBetweenISO(PM, start), 0);
    return {
        startTime: start,
        endTime: end,
        totalDuration: totalDuration,
        am: am,
        pm: pm,
        eve: eve,
    };
}
function getTimeBetweenISO(start, end) {
    var ord = compareISOTime(start, end);
    if (ord >= 0)
        return 0;
    // Now we know the start time is before the end time
    var _a = [
        parseInt(start.slice(0, 2)),
        parseInt(start.slice(3)),
    ], hours1 = _a[0], minutes1 = _a[1];
    var _b = [
        parseInt(end.slice(0, 2)),
        parseInt(end.slice(3)),
    ], hours2 = _b[0], minutes2 = _b[1];
    return hours2 * 60 + minutes2 - (hours1 * 60 + minutes1);
}
/** TESTING */
// @ts-ignore
var plHw = new classes_1.Task("312 homework", 120, "am");
var grading = new classes_1.Task("grade resubs", 30);
// @ts-ignore
var journal = new classes_1.Task("journal", 15, "pm");
var bmeQuiz = new classes_1.Task("bme quiz :(", 120);
var testHighTasks = [plHw, grading, journal, bmeQuiz];
var goGym = new classes_1.Task("go to gym", 120);
var seeKev = new classes_1.Task("see kev", 30);
var rockClimb = new classes_1.Task("Rock climbing", 120, "pm");
var dinnerWithGirls = new classes_1.Task("women in din", 120, "eve");
var testLowTasks = [goGym, seeKev, rockClimb, dinnerWithGirls];
var lecture1 = new classes_1.CalendarEvent("210 Lecture", "09:00", "10:50");
var lecture2 = new classes_1.CalendarEvent("312 Lecture", "12:30", "13:50");
var soccer = new classes_1.CalendarEvent("Soccer practice", "16:00", "20:00");
var testEvents = [lecture1, lecture2, soccer];
console.log("Final result", makeSchedule(testHighTasks, testLowTasks, testEvents, "07:00", "22:00"));
