'use strict';

import { dateFormat } from '../dateformat.js';
import { unionOptions, assembleOutput } from '../utils.js';

// Stack trace format :
// https://github.com/v8/v8/wiki/Stack%20Trace%20API
const stackReg = /at\s+(.*)\s+\((.*):(\d*):(\d*)\)/i;
const stackReg2 = /at\s+()(.*):(\d*):(\d*)/i;

function noop() { }

function fwrap(fn) {
    return function (str) { return fn(str) };
}

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

export { Logging };