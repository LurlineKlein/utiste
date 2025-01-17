(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.Logging = factory());
}(this, function () { 'use strict';

    /*
     * Date Format 1.2.3
     * (c) 2007-2009 Steven Levithan <stevenlevithan.com>
     * MIT license
     *
     * Includes enhancements by Scott Trenda <scott.trenda.net>
     * and Kris Kowal <cixar.com/~kris.kowal/>
     *
     * Accepts a date, a mask, or a date and a mask.
     * Returns a formatted version of the given date.
     * The date defaults to the current date/time.
     * The mask defaults to dateFormat.masks.default.
     */

    var dateFormat = (function () {
        var token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZWNVG]|"[^"]*"|'[^']*'/g;
        var timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g;
        var timezoneClip = /[^-+\dA-Z]/g;

        // Regexes and supporting functions are cached through closure
        return function (date, mask, utc, gmt) {

            // You can't provide utc if you skip other args (use the 'UTC:' mask prefix)
            if (arguments.length === 1 && kindOf(date) === 'string' && !/\d/.test(date)) {
                mask = date;
                date = undefined;
            }

            date = date || new Date;

            if (!(date instanceof Date)) {
                date = new Date(date);
            }

            if (isNaN(date)) {
                throw TypeError('Invalid date');
            }

            mask = String(dateFormat.masks[mask] || mask || dateFormat.masks['default']);

            // Allow setting the utc/gmt argument via the mask
            var maskSlice = mask.slice(0, 4);
            if (maskSlice === 'UTC:' || maskSlice === 'GMT:') {
                mask = mask.slice(4);
                utc = true;
                if (maskSlice === 'GMT:') {
                    gmt = true;
                }
            }

            var _ = utc ? 'getUTC' : 'get';
            var d = date[_ + 'Date']();
            var D = date[_ + 'Day']();
            var m = date[_ + 'Month']();
            var y = date[_ + 'FullYear']();
            var H = date[_ + 'Hours']();
            var M = date[_ + 'Minutes']();
            var s = date[_ + 'Seconds']();
            var L = date[_ + 'Milliseconds']();
            var o = utc ? 0 : date.getTimezoneOffset();
            var flags = {
                d: d,
                dd: pad(d),
                ddd: dateFormat.i18n.dayNames[D],
                dddd: dateFormat.i18n.dayNames[D + 7],
                m: m + 1,
                mm: pad(m + 1),
                mmm: dateFormat.i18n.monthNames[m],
                mmmm: dateFormat.i18n.monthNames[m + 12],
                yy: String(y).slice(2),
                yyyy: y,
                h: H % 12 || 12,
                hh: pad(H % 12 || 12),
                H: H,
                HH: pad(H),
                M: M,
                MM: pad(M),
                s: s,
                ss: pad(s),
                l: pad(L, 3),
                L: pad(Math.round(L / 10)),
                t: H < 12 ? 'a' : 'p',
                tt: H < 12 ? 'am' : 'pm',
                T: H < 12 ? 'A' : 'P',
                TT: H < 12 ? 'AM' : 'PM',
                Z: gmt ? 'GMT' : utc ? 'UTC' : (String(date).match(timezone) || ['']).pop().replace(timezoneClip, ''),
                o: (o > 0 ? '-' : '+') + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
                S: ['th', 'st', 'nd', 'rd'][d % 10 > 3 ? 0 : (d % 100 - d % 10 != 10) * d % 10],
                W: getWeek,
                N: getDayOfWeek,
                V: getWeek,
                G: getWeekYear
            };

            return mask.replace(token, function (match) {
                if (match in flags) {
                    var f = flags[match];
                    if (typeof (f) === 'function') {
                        var val = f(date);
                        flags[match] = val;
                        return val;
                    } else {
                        return f;
                    }
                } else {
                    return match.slice(1, match.length - 1);
                }
            });
        };
    })();

    dateFormat.masks = {
        'default': 'ddd mmm dd yyyy HH:MM:ss',
        'shortDate': 'm/d/yy',
        'mediumDate': 'mmm d, yyyy',
        'longDate': 'mmmm d, yyyy',
        'fullDate': 'dddd, mmmm d, yyyy',
        'shortTime': 'h:MM TT',
        'mediumTime': 'h:MM:ss TT',
        'longTime': 'h:MM:ss TT Z',
        'isoDate': 'yyyy-mm-dd',
        'isoTime': 'HH:MM:ss',
        'isoDateTime': 'yyyy-mm-dd\'T\'HH:MM:sso',
        'isoUtcDateTime': 'UTC:yyyy-mm-dd\'T\'HH:MM:ss\'Z\'',
        'expiresHeaderFormat': 'ddd, dd mmm yyyy HH:MM:ss Z'
    };

    // Internationalization strings
    dateFormat.i18n = {
        dayNames: [
            'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
            'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
        ],
        monthNames: [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
            'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'
        ]
    };

    function pad(val, len) {
        val = String(val);
        len = len || 2;
        while (val.length < len) {
            val = '0' + val;
        }
        return val;
    }

    /**
     * Get the ISO 8601 week number
     * Based on comments from
     * http://techblog.procurios.nl/k/n618/news/view/33796/14863/Calculate-ISO-8601-week-and-year-in-javascript.html
     *
     * @param  {Object} `date`
     * @return {Number}
     */
    function getWeek(date) {
        // Create a copy of date object
        var target = new Date(date.valueOf());

        // ISO week date weeks start on monday
        // so correct the day number
        var dayNr = (date.getDay() + 6) % 7;

        // ISO 8601 states that week 1 is the week
        // with the first thursday of that year.
        // Set the target date to the thursday in the target week
        target.setDate(target.getDate() - dayNr + 3);

        // Store the millisecond value of the target date
        var firstThursday = target.valueOf();

        // Set the target to the first thursday of the year
        // First set the target to january first
        target.setMonth(0, 1);
        // Not a thursday? Correct the date to the next thursday
        if (target.getDay() !== 4) {
            target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
        }

        // The weeknumber is the number of weeks between the
        // first thursday of the year and the thursday in the target week
        return 1 + Math.ceil((firstThursday - target) / 604800000); // 604800000 = 7 * 24 * 3600 * 1000
    }

    function getWeekYear(date) {
        // Create a new date object for the thursday of date's week
        var target = new Date(date.valueOf());
        target.setDate(target.getDate() - ((date.getDay() + 6) % 7) + 3);

        return target.getFullYear();
    }

    /**
     * Get ISO-8601 numeric representation of the day of the week
     * 1 (for Monday) through 7 (for Sunday)
     *
     * @param  {Object} `date`
     * @return {Number}
     */
    function getDayOfWeek(date) {
        var dow = date.getDay();
        if (dow === 0) {
            dow = 7;
        }
        return dow;
    }

    /**
     * kind-of shortcut
     * @param  {*} val
     * @return {String}
     */
    function kindOf(val) {
        if (val === null) {
            return 'null';
        }

        if (val === undefined) {
            return 'undefined';
        }

        if (typeof val !== 'object') {
            return typeof val;
        }

        if (Array.isArray(val)) {
            return 'array';
        }

        return {}.toString.call(val).slice(8, -1).toLowerCase();
    }

    function unionOptions(defaultOptions, options) {
        for (let prop in options) {
            defaultOptions[prop] = options[prop];
        }
        return defaultOptions;
    }

    function assembleOutput(format) {
        return new Function('timestamp', 'title', 'level', 'message', 'file', 'line', 'pos', 'path', 'method', 'stack', 'return `' + format + '`;');
    }

    function assembleFilePath(format) {
        return new Function('path', 'filename', 'filenameDateFormat', 'return `' + format + '`;');
    }

    // Stack trace format :
    // https://github.com/v8/v8/wiki/Stack%20Trace%20API
    const stackReg = /at\s+(.*)\s+\((.*):(\d*):(\d*)\)/i;
    const stackReg2 = /at\s+()(.*):(\d*):(\d*)/i;

    // color ... one of black, red, green, yellow, blue, magenta, cyan and white
    function colorText(color, text) {
        switch (color) {
            case 'black':
                text = '\x1B[30m' + text; break;
            case 'red':
                text = '\x1B[31m' + text; break;
            case 'green':
                text = '\x1B[32m' + text; break;
            case 'yellow':
                text = '\x1B[33m' + text; break;
            case 'blue':
                text = '\x1B[34m' + text; break;
            case 'magenta':
                text = '\x1B[35m' + text; break;
            case 'cyan':
                text = '\x1B[36m' + text; break;
            case 'white':
                text = '\x1B[37m' + text; break;
            default:
                return text;
        }
        return text + '\x1B[39m';
    };

    function Logging(options) {
        const defaultOptions = {
            format: "${timestamp} <${title}> ${file}:${line} ${method} ${message}",
            dateformat: "isoDateTime",
            preprocess: function (data) {
            },
            transport: function (data) {
                console.log(data.output);
            },
            filters: [],
            level: 'debug',
            methods: ['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'],
            stackIndex: 0  // get the specified index of stack as file information. It is userful for development package.
        };

        // union options and defaultOptions
        options = unionOptions(defaultOptions, options);

        // RFC 5424 levels
        // http://tools.ietf.org/html/rfc5424
        // debug, info, notice, warning, error, critical, alert, emergency

        // set and get the level, default 0 meaning debug (array index)
        // internal the level is always a number
        this.getLevel = function () {
            return options.methods[_level];
        };
        this.setLevel = function (level) {
            if (typeof level === 'string') {
                let ind = options.methods.indexOf(level);
                if (ind !== -1) {
                    _level = ind;
                } else {
                    _level = 0;
                }
            } else if (typeof level === 'number') {
                _level = Math.min(Math.max(level, 0), options.methods.length);
            } else {
                _level = 0;
            }
            return that.getLevel();
        };

        this.close = function () {
            _level = Number.MAX_VALUE;
        };

        // private variable
        var _level = 0;
        // for access in inner functions
        var that = this;

        // set private variable _level
        this.setLevel(options.level);

        // make sure the following options are arrays
        if (!Array.isArray(options.format)) {
            options.format = [options.format];
        }
        if (!Array.isArray(options.filters)) {
            options.filters = [options.filters];
        }
        if (!Array.isArray(options.transport)) {
            options.transport = [options.transport];
        }

        let filterLength = options.filters.length;
        let lastFilter;
        if (filterLength > 0) {
            filterLength -= 1;
            if (Object.prototype.toString.call(options.filters[filterLength]) === '[object Object]') {
                lastFilter = options.filters[filterLength];
                options.filters = options.filters.slice(0, filterLength);
            }
        }

        for (let i = 0; i < options.methods.length; i++) {
            let title = options.methods[i];
            if (i < _level)
                this[title] = function () { };
            else {
                // get format, either the method specific or the default
                let format = options.format[0];
                if (options.format.length === 2 && options.format[1][title])
                    format = options.format[1][title];

                // check if stack must be analysed
                let needstack = /\${(method|path|line|pos|file)}/i.test(format);

                // get filter, either the method specific or the default
                let filters;
                if (lastFilter && lastFilter[title]) {
                    filters = Array.isArray(lastFilter[title]) ? lastFilter[title] : [lastFilter[title]];
                } else {
                    filters = options.filters;
                }

                this[title] = function (...args) {
                    return log(options, i, title, format, needstack, filters, args);
                };
            }
        }

        function log(config, level, title, format, needstack, filters, args) {
            //check level
            if (level < _level) {
                return;
            }

            var data = {
                timestamp: dateFormat(new Date(), config.dateformat),
                title: title,
                level: level,
                message: '',
                args: args
            };
            data.file = data.line = data.pos = data.path = data.method = data.stack = '';

            if (needstack) {
                // get call stack, and analyze it
                // get all file, method and line number
                var stacklist = (new Error()).stack.split('\n').slice(3);
                var s = stacklist[config.stackIndex] || stacklist[0],
                    sp = stackReg.exec(s) || stackReg2.exec(s);
                if (sp && sp.length === 5) {
                    data.method = sp[1];
                    data.path = sp[2];
                    data.line = sp[3];
                    data.pos = sp[4];
                    data.file = data.path.split(/[\\/]/).pop();
                    data.stack = stacklist.join('\n');
                }
            }

            // call preprocess function
            config.preprocess(data);
            // join all arguments for message
            data.message = args.join(' + ');
            let template = assembleOutput(format);
            data.output = template(data.timestamp, data.title, data.level, data.message, data.file, data.line, data.pos, data.path, data.method, data.stack);

            // process every filter, can be a function or color string
            for (let i = 0; i < filters.length; i++) {
                if (typeof filters[i] === 'string') {
                    let arr = data.output.split('\n');
                    for (let j = 0; j < arr.length; j++) {
                        arr[j] = colorText(filters[i], arr[j]);
                    }
                    data.output = arr.join('\n');
                } else {
                    data.output = filters[i](data.output);
                }
                if (!data.output) { // cancel next process if return a false(include null, undefined)
                    return data;
                }
            }

            // trans the final result
            config.transport.forEach(function (tras) {
                tras(data);
            });

            return data;
        }
    }

    function logToConsole(options) {
        return new Logging(options);
    }

    function logToColorConsole(options) {
        let opt = {
            filters: {
                debug: 'white',
                info: 'yellow',
                notice: 'green',
                warning: 'blue',
                error: 'red',
                critical: 'red',
                alert: 'cyan',
                emergency: 'magenta'
            }
        };
        options = unionOptions(opt, options)

        return new Logging(options);
    }

    let fs = require('fs');
    let path = require('path');

    function createDirectory(dir) {
        if (fs.existsSync(dir)) return;
        createDirectory(path.dirname(dir));
        fs.mkdirSync(dir);
    }

    function logToDailyFile (options) {
        const defaultFileOptions = {
            path: '.',
            filename: 'js-logging',
            filenameDateFormat: 'yyyymmdd',
            pathFormat: '${path}/${filename}${filenameDateFormat}.log',
            lineEnding: '\r\n'
        };
        
        options = unionOptions(defaultFileOptions, options);
        
        function LogFile(date) {
            let template = assembleFilePath(options.pathFormat);
            date = '.' + date;
            let path = template(options.path, options.filename, date);
            createDirectory(options.path);
            this.stream = fs.createWriteStream(path, { flags: 'a', defaultEncoding: 'utf8', fd: null, mode: 0o666, autoClose: true });
        }
        LogFile.prototype.write = function (str) {
            this.stream.write(str + options.lineEnding);
        };
        LogFile.prototype.destroy = function () {
            if (this.stream) {
                this.stream.end();
                this.stream = null;
            }
        };

        let logFile = null;

        function dailyFileTransport(data) {
            
            // check time
            let now = dateFormat(new Date(), options.filenameDateFormat);
            if (logFile && logFile.date != now) {
                logFile.destroy();
                logFile = null;
            }
            if (!logFile) {
                logFile = new LogFile(now);
            }
            logFile.write(data.output);
        }

        if (options.transport) {
            options.transport = Array.isArray(options.transport) ? options.transport : [options.transport];
            options.transport.push(dailyFileTransport)
        } else {
            options.transport = [dailyFileTransport];
        }
        
        return new Logging(options);
    }

    Logging.console = logToConsole;
    Logging.colorConsole = logToColorConsole;
    Logging.dailyFile = logToDailyFile;

    return Logging;

}));