"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarEvent = exports.ScheduledTask = exports.Task = void 0;
var Task = /** @class */ (function () {
    function Task(name, minutes, pref) {
        if (pref === void 0) { pref = null; }
        this.name = name;
        this.minutes = minutes;
        this.pref = pref;
    }
    return Task;
}());
exports.Task = Task;
var ScheduledTask = /** @class */ (function (_super) {
    __extends(ScheduledTask, _super);
    function ScheduledTask(name, minutes, start, end, pref) {
        if (pref === void 0) { pref = null; }
        var _this = _super.call(this, name, minutes, pref) || this;
        _this.start = start;
        _this.end = end;
        return _this;
    }
    return ScheduledTask;
}(Task));
exports.ScheduledTask = ScheduledTask;
var CalendarEvent = /** @class */ (function () {
    function CalendarEvent(name, start, end) {
        this.name = name;
        this.start = start;
        this.end = end;
    }
    return CalendarEvent;
}());
exports.CalendarEvent = CalendarEvent;
