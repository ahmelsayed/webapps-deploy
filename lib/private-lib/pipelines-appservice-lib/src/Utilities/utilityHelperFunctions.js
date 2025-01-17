"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const child = require("child_process");
const path = require("path");
const events = require("events");
const fs = __importStar(require("fs"));
const os = require("os");
var shell = require('shelljs');
var minimatch = require('minimatch');
function cp(source, dest, options, continueOnError) {
    if (options) {
        shell.cp(options, source, dest);
    }
    else {
        shell.cp(source, dest);
    }
    _checkShell('cp', continueOnError);
}
exports.cp = cp;
function _checkShell(cmd, continueOnError) {
    var se = shell.error();
    if (se) {
        console.log("##[debug]" + cmd + ' failed');
        var errMsg = 'Failed ' + cmd + ': ' + se;
        console.log("##[debug]" + errMsg);
        if (!continueOnError) {
            throw new Error(errMsg);
        }
    }
}
exports._checkShell = _checkShell;
function mkdirP(p) {
    if (!p) {
        throw new Error('p not supplied');
    }
    // build a stack of directories to create
    let stack = [];
    let testDir = p;
    while (true) {
        // validate the loop is not out of control
        if (stack.length >= (process.env['TASKLIB_TEST_MKDIRP_FAILSAFE'] || 1000)) {
            // let the framework throw
            console.log('##[debug]loop is out of control');
            fs.mkdirSync(p);
            return;
        }
        console.log(`##[debug]testing directory '${testDir}'`);
        let stats;
        try {
            stats = fs.statSync(testDir);
        }
        catch (err) {
            if (err.code == 'ENOENT') {
                // validate the directory is not the drive root
                let parentDir = path.dirname(testDir);
                if (testDir == parentDir) {
                    throw new Error('Unable to create directory ' + p + '. Root directory does not exist: ' + testDir);
                }
                // push the dir and test the parent
                stack.push(testDir);
                testDir = parentDir;
                continue;
            }
            else if (err.code == 'UNKNOWN') {
                throw new Error('Unable to create directory ' + p + '. Unable to verify the directory exists: ' + testDir + '. If directory is a file share, please verify the share name is correct, the share is online, and the current process has permission to access the share.');
            }
            else {
                throw err;
            }
        }
        if (!stats.isDirectory()) {
            throw new Error('Unable to create directory ' + p + '. Conflicting file exists: ' + testDir);
        }
        // testDir exists
        break;
    }
    // create each directory
    while (stack.length) {
        let dir = stack.pop(); // non-null because `stack.length` was truthy
        console.log(`##[debug]mkdir '${dir}'`);
        try {
            fs.mkdirSync(dir);
        }
        catch (err) {
            throw new Error('Unable to create directory ' + p + ' . ' + err.message);
        }
    }
}
exports.mkdirP = mkdirP;
function find(findPath) {
    if (!findPath) {
        console.log('##[debug]no path specified');
        return [];
    }
    // normalize the path, otherwise the first result is inconsistently formatted from the rest of the results
    // because path.join() performs normalization.
    findPath = path.normalize(findPath);
    // debug trace the parameters
    console.log(`##[debug]findPath: '${findPath}'`);
    // return empty if not exists
    try {
        fs.lstatSync(findPath);
    }
    catch (err) {
        if (err.code == 'ENOENT') {
            console.log('##[debug]0 results');
            return [];
        }
        throw err;
    }
    try {
        let result = [];
        // push the first item
        let stack = [new _FindItem(findPath, 1)];
        let traversalChain = []; // used to detect cycles
        while (stack.length) {
            // pop the next item and push to the result array
            let item = stack.pop(); // non-null because `stack.length` was truthy
            result.push(item.path);
            // stat the item.  the stat info is used further below to determine whether to traverse deeper
            //
            // stat returns info about the target of a symlink (or symlink chain),
            // lstat returns info about a symlink itself
            let stats;
            // use lstat (not following symlinks)
            stats = fs.lstatSync(item.path);
            // note, isDirectory() returns false for the lstat of a symlink
            if (stats.isDirectory()) {
                console.log(`##[debug]  ${item.path} (directory)`);
                // push the child items in reverse onto the stack
                let childLevel = item.level + 1;
                let childItems = fs.readdirSync(item.path)
                    .map((childName) => new _FindItem(path.join(item.path, childName), childLevel));
                for (var i = childItems.length - 1; i >= 0; i--) {
                    stack.push(childItems[i]);
                }
            }
            else {
                console.log(`##[debug]  ${item.path} (file)`);
            }
        }
        console.log(`##[debug]${result.length} results`);
        return result;
    }
    catch (err) {
        throw new Error('Failed find: ' + err.message);
    }
}
exports.find = find;
class _FindItem {
    constructor(path, level) {
        this.path = path;
        this.level = level;
    }
}
function _getDefaultMatchOptions() {
    return {
        debug: false,
        nobrace: true,
        noglobstar: false,
        dot: true,
        noext: false,
        nocase: process.platform == 'win32',
        nonull: false,
        matchBase: false,
        nocomment: false,
        nonegate: false,
        flipNegate: false
    };
}
function _debugMatchOptions(options) {
    console.log(`##[debug]matchOptions.debug: '${options.debug}'`);
    console.log(`##[debug]matchOptions.nobrace: '${options.nobrace}'`);
    console.log(`##[debug]matchOptions.noglobstar: '${options.noglobstar}'`);
    console.log(`##[debug]matchOptions.dot: '${options.dot}'`);
    console.log(`##[debug]matchOptions.noext: '${options.noext}'`);
    console.log(`##[debug]matchOptions.nocase: '${options.nocase}'`);
    console.log(`##[debug]matchOptions.nonull: '${options.nonull}'`);
    console.log(`##[debug]matchOptions.matchBase: '${options.matchBase}'`);
    console.log(`##[debug]matchOptions.nocomment: '${options.nocomment}'`);
    console.log(`##[debug]matchOptions.nonegate: '${options.nonegate}'`);
    console.log(`##[debug]matchOptions.flipNegate: '${options.flipNegate}'`);
}
function match(list, patterns, patternRoot, options) {
    // trace parameters
    console.log(`##[debug]patternRoot: '${patternRoot}'`);
    options = options || _getDefaultMatchOptions(); // default match options
    _debugMatchOptions(options);
    // convert pattern to an array
    if (typeof patterns == 'string') {
        patterns = [patterns];
    }
    // hashtable to keep track of matches
    let map = {};
    let originalOptions = options;
    for (let pattern of patterns) {
        console.log(`##[debug]pattern: '${pattern}'`);
        // trim and skip empty
        pattern = (pattern || '').trim();
        if (!pattern) {
            console.log('##[debug]skipping empty pattern');
            continue;
        }
        // clone match options
        let options = _cloneMatchOptions(originalOptions);
        // skip comments
        if (!options.nocomment && _startsWith(pattern, '#')) {
            console.log('##[debug]skipping comment');
            continue;
        }
        // set nocomment - brace expansion could result in a leading '#'
        options.nocomment = true;
        // determine whether pattern is include or exclude
        let negateCount = 0;
        if (!options.nonegate) {
            while (pattern.charAt(negateCount) == '!') {
                negateCount++;
            }
            pattern = pattern.substring(negateCount); // trim leading '!'
            if (negateCount) {
                console.log(`##[debug]trimmed leading '!'. pattern: '${pattern}'`);
            }
        }
        let isIncludePattern = negateCount == 0 ||
            (negateCount % 2 == 0 && !options.flipNegate) ||
            (negateCount % 2 == 1 && options.flipNegate);
        // set nonegate - brace expansion could result in a leading '!'
        options.nonegate = true;
        options.flipNegate = false;
        // expand braces - required to accurately root patterns
        let expanded;
        let preExpanded = pattern;
        if (options.nobrace) {
            expanded = [pattern];
        }
        else {
            // convert slashes on Windows before calling braceExpand(). unfortunately this means braces cannot
            // be escaped on Windows, this limitation is consistent with current limitations of minimatch (3.0.3).
            console.log('##[debug]expanding braces');
            let convertedPattern = process.platform == 'win32' ? pattern.replace(/\\/g, '/') : pattern;
            expanded = minimatch.braceExpand(convertedPattern);
        }
        // set nobrace
        options.nobrace = true;
        for (let pattern of expanded) {
            if (expanded.length != 1 || pattern != preExpanded) {
                console.log(`##[debug]pattern: '${pattern}'`);
            }
            // trim and skip empty
            pattern = (pattern || '').trim();
            if (!pattern) {
                console.log('##[debug]skipping empty pattern');
                continue;
            }
            // root the pattern when all of the following conditions are true:
            if (patternRoot && // patternRoot supplied
                !_isRooted(pattern) && // AND pattern not rooted
                // AND matchBase:false or not basename only
                (!options.matchBase || (process.platform == 'win32' ? pattern.replace(/\\/g, '/') : pattern).indexOf('/') >= 0)) {
                pattern = _ensureRooted(patternRoot, pattern);
                console.log(`##[debug]rooted pattern: '${pattern}'`);
            }
            if (isIncludePattern) {
                // apply the pattern
                console.log('##[debug]applying include pattern against original list');
                let matchResults = minimatch.match(list, pattern, options);
                console.log("##[debug]" + matchResults.length + ' matches');
                // union the results
                for (let matchResult of matchResults) {
                    map[matchResult] = true;
                }
            }
            else {
                // apply the pattern
                console.log('##[debug]applying exclude pattern against original list');
                let matchResults = minimatch.match(list, pattern, options);
                console.log("##[debug]" + matchResults.length + ' matches');
                // substract the results
                for (let matchResult of matchResults) {
                    delete map[matchResult];
                }
            }
        }
    }
    // return a filtered version of the original list (preserves order and prevents duplication)
    let result = list.filter((item) => map.hasOwnProperty(item));
    console.log("##[debug]" + result.length + ' final results');
    return result;
}
exports.match = match;
/**
 * Exec a tool synchronously.  Convenience wrapper over ToolRunner to execSync with args in one call.
 * Output will be *not* be streamed to the live console.  It will be returned after execution is complete.
 * Appropriate for short running tools
 * Returns IExecResult with output and return code
 *
 * @param     tool     path to tool to exec
 * @param     args     an arg string or array of args
 * @param     options  optional exec options.  See IExecSyncOptions
 * @returns   IExecSyncResult
 */
function execSync(tool, args, options) {
    let tr = this.tool(tool);
    tr.on('debug', (data) => {
        console.log("##[debug]" + data);
    });
    if (args) {
        if (args instanceof Array) {
            tr.arg(args);
        }
        else if (typeof (args) === 'string') {
            tr.line(args);
        }
    }
    return tr.execSync(options);
}
exports.execSync = execSync;
/**
 * Convenience factory to create a ToolRunner.
 *
 * @param     tool     path to tool to exec
 * @returns   ToolRunner
 */
function tool(tool) {
    let tr = new ToolRunner(tool);
    tr.on('debug', (message) => {
        console.log("##[debug]" + message);
    });
    return tr;
}
exports.tool = tool;
function _cloneMatchOptions(matchOptions) {
    return {
        debug: matchOptions.debug,
        nobrace: matchOptions.nobrace,
        noglobstar: matchOptions.noglobstar,
        dot: matchOptions.dot,
        noext: matchOptions.noext,
        nocase: matchOptions.nocase,
        nonull: matchOptions.nonull,
        matchBase: matchOptions.matchBase,
        nocomment: matchOptions.nocomment,
        nonegate: matchOptions.nonegate,
        flipNegate: matchOptions.flipNegate
    };
}
function _startsWith(str, start) {
    return str.slice(0, start.length) == start;
}
function _isRooted(p) {
    p = _normalizeSeparators(p);
    if (!p) {
        throw new Error('isRooted() parameter "p" cannot be empty');
    }
    if (process.platform == 'win32') {
        return _startsWith(p, '\\') || // e.g. \ or \hello or \\hello
            /^[A-Z]:/i.test(p); // e.g. C: or C:\hello
    }
    return _startsWith(p, '/'); // e.g. /hello
}
function _ensureRooted(root, p) {
    if (!root) {
        throw new Error('ensureRooted() parameter "root" cannot be empty');
    }
    if (!p) {
        throw new Error('ensureRooted() parameter "p" cannot be empty');
    }
    if (_isRooted(p)) {
        return p;
    }
    if (process.platform == 'win32' && root.match(/^[A-Z]:$/i)) { // e.g. C:
        return root + p;
    }
    // ensure root ends with a separator
    if (_endsWith(root, '/') || (process.platform == 'win32' && _endsWith(root, '\\'))) {
        // root already ends with a separator
    }
    else {
        root += path.sep; // append separator
    }
    return root + p;
}
function _normalizeSeparators(p) {
    p = p || '';
    if (process.platform == 'win32') {
        // convert slashes on Windows
        p = p.replace(/\//g, '\\');
        // remove redundant slashes
        let isUnc = /^\\\\+[^\\]/.test(p); // e.g. \\hello
        return (isUnc ? '\\' : '') + p.replace(/\\\\+/g, '\\'); // preserve leading // for UNC
    }
    // remove redundant slashes
    return p.replace(/\/\/+/g, '/');
}
function _endsWith(str, end) {
    return str.slice(-end.length) == end;
}
function _which(tool, check) {
    if (!tool) {
        throw new Error('parameter \'tool\' is required');
    }
    // recursive when check=true
    if (check) {
        let result = _which(tool, false);
        if (!result) {
            throw new Error("Unable to locate executable file: " + tool);
        }
    }
    console.log(`##[debug]which '${tool}'`);
    try {
        // build the list of extensions to try
        let extensions = [];
        if (process.platform == 'win32' && process.env['PATHEXT']) {
            for (let extension of process.env['PATHEXT'].split(path.delimiter)) {
                if (extension) {
                    extensions.push(extension);
                }
            }
        }
        // if it's rooted, return it if exists. otherwise return empty.
        if (_isRooted(tool)) {
            let filePath = _tryGetExecutablePath(tool, extensions);
            if (filePath) {
                console.log(`##[debug]found: '${filePath}'`);
                return filePath;
            }
            console.log('##[debug]not found');
            return '';
        }
        // if any path separators, return empty
        if (tool.indexOf('/') >= 0 || (process.platform == 'win32' && tool.indexOf('\\') >= 0)) {
            console.log('##[debug]not found');
            return '';
        }
        // build the list of directories
        //
        // Note, technically "where" checks the current directory on Windows. From a task lib perspective,
        // it feels like we should not do this. Checking the current directory seems like more of a use
        // case of a shell, and the which() function exposed by the task lib should strive for consistency
        // across platforms.
        let directories = [];
        if (process.env['PATH']) {
            for (let p of process.env['PATH'].split(path.delimiter)) {
                if (p) {
                    directories.push(p);
                }
            }
        }
        // return the first match
        for (let directory of directories) {
            let filePath = _tryGetExecutablePath(directory + path.sep + tool, extensions);
            if (filePath) {
                console.log(`##[debug]found: '${filePath}'`);
                return filePath;
            }
        }
        console.log('##[debug]not found');
        return '';
    }
    catch (err) {
        throw new Error('Failed ' + 'which' + ': ' + err.message);
    }
}
/**
 * Best effort attempt to determine whether a file exists and is executable.
 * @param filePath    file path to check
 * @param extensions  additional file extensions to try
 * @return if file exists and is executable, returns the file path. otherwise empty string.
 */
function _tryGetExecutablePath(filePath, extensions) {
    try {
        // test file exists
        let stats = fs.statSync(filePath);
        if (stats.isFile()) {
            if (process.platform == 'win32') {
                // on Windows, test for valid extension
                let isExecutable = false;
                let fileName = path.basename(filePath);
                let dotIndex = fileName.lastIndexOf('.');
                if (dotIndex >= 0) {
                    let upperExt = fileName.substr(dotIndex).toUpperCase();
                    if (extensions.some(validExt => validExt.toUpperCase() == upperExt)) {
                        return filePath;
                    }
                }
            }
            else {
                if (isUnixExecutable(stats)) {
                    return filePath;
                }
            }
        }
    }
    catch (err) {
        if (err.code != 'ENOENT') {
            console.log(`##[debug]Unexpected error attempting to determine if executable file exists '${filePath}': ${err}`);
        }
    }
    // try each extension
    let originalFilePath = filePath;
    for (let extension of extensions) {
        let found = false;
        let filePath = originalFilePath + extension;
        try {
            let stats = fs.statSync(filePath);
            if (stats.isFile()) {
                if (process.platform == 'win32') {
                    // preserve the case of the actual file (since an extension was appended)
                    try {
                        let directory = path.dirname(filePath);
                        let upperName = path.basename(filePath).toUpperCase();
                        for (let actualName of fs.readdirSync(directory)) {
                            if (upperName == actualName.toUpperCase()) {
                                filePath = path.join(directory, actualName);
                                break;
                            }
                        }
                    }
                    catch (err) {
                        console.log(`##[debug]Unexpected error attempting to determine the actual case of the file '${filePath}': ${err}`);
                    }
                    return filePath;
                }
                else {
                    if (isUnixExecutable(stats)) {
                        return filePath;
                    }
                }
            }
        }
        catch (err) {
            if (err.code != 'ENOENT') {
                console.log(`##[debug]Unexpected error attempting to determine if executable file exists '${filePath}': ${err}`);
            }
        }
    }
    return '';
}
// on Mac/Linux, test the execute bit
//     R   W  X  R  W X R W X
//   256 128 64 32 16 8 4 2 1
function isUnixExecutable(stats) {
    return (stats.mode & 1) > 0 || ((stats.mode & 8) > 0 && stats.gid === process.getgid()) || ((stats.mode & 64) > 0 && stats.uid === process.getuid());
}
class ToolRunner extends events.EventEmitter {
    constructor(toolPath) {
        super();
        if (!toolPath) {
            throw new Error('Parameter \'toolPath\' cannot be null or empty.');
        }
        this.toolPath = _which(toolPath, true);
        this.args = [];
        console.log('##[debug]toolRunner toolPath: ' + toolPath);
    }
    _argStringToArray(argString) {
        var args = [];
        var inQuotes = false;
        var escaped = false;
        var arg = '';
        var append = function (c) {
            // we only escape double quotes.
            if (escaped && c !== '"') {
                arg += '\\';
            }
            arg += c;
            escaped = false;
        };
        for (var i = 0; i < argString.length; i++) {
            var c = argString.charAt(i);
            if (c === '"') {
                if (!escaped) {
                    inQuotes = !inQuotes;
                }
                else {
                    append(c);
                }
                continue;
            }
            if (c === "\\" && escaped) {
                append(c);
                continue;
            }
            if (c === "\\" && inQuotes) {
                escaped = true;
                continue;
            }
            if (c === ' ' && !inQuotes) {
                if (arg.length > 0) {
                    args.push(arg);
                    arg = '';
                }
                continue;
            }
            append(c);
        }
        if (arg.length > 0) {
            args.push(arg.trim());
        }
        return args;
    }
    _getCommandString(options, noPrefix) {
        let toolPath = this._getSpawnFileName();
        let args = this._getSpawnArgs(options);
        let cmd = noPrefix ? '' : '[command]'; // omit prefix when piped to a second tool
        if (process.platform == 'win32') {
            // Windows + cmd file
            if (this._isCmdFile()) {
                cmd += toolPath;
                args.forEach((a) => {
                    cmd += ` ${a}`;
                });
            }
            // Windows + verbatim
            else if (options.windowsVerbatimArguments) {
                cmd += `"${toolPath}"`;
                args.forEach((a) => {
                    cmd += ` ${a}`;
                });
            }
            // Windows (regular)
            else {
                cmd += this._windowsQuoteCmdArg(toolPath);
                args.forEach((a) => {
                    cmd += ` ${this._windowsQuoteCmdArg(a)}`;
                });
            }
        }
        else {
            // OSX/Linux - this can likely be improved with some form of quoting.
            // creating processes on Unix is fundamentally different than Windows.
            // on Unix, execvp() takes an arg array.
            cmd += toolPath;
            args.forEach((a) => {
                cmd += ` ${a}`;
            });
        }
        // append second tool
        if (this.pipeOutputToTool) {
            cmd += ' | ' + this.pipeOutputToTool._getCommandString(options, /*noPrefix:*/ true);
        }
        return cmd;
    }
    _getSpawnFileName() {
        if (process.platform == 'win32') {
            if (this._isCmdFile()) {
                return process.env['COMSPEC'] || 'cmd.exe';
            }
        }
        return this.toolPath;
    }
    _getSpawnArgs(options) {
        if (process.platform == 'win32') {
            if (this._isCmdFile()) {
                let argline = `/D /S /C "${this._windowsQuoteCmdArg(this.toolPath)}`;
                for (let i = 0; i < this.args.length; i++) {
                    argline += ' ';
                    argline += options.windowsVerbatimArguments ? this.args[i] : this._windowsQuoteCmdArg(this.args[i]);
                }
                argline += '"';
                return [argline];
            }
            if (options.windowsVerbatimArguments) {
                // note, in Node 6.x options.argv0 can be used instead of overriding args.slice and args.unshift.
                // for more details, refer to https://github.com/nodejs/node/blob/v6.x/lib/child_process.js
                let args = this.args.slice(0); // copy the array
                // override slice to prevent Node from creating a copy of the arg array.
                // we need Node to use the "unshift" override below.
                args.slice = function () {
                    if (arguments.length != 1 || arguments[0] != 0) {
                        throw new Error('Unexpected arguments passed to args.slice when windowsVerbatimArguments flag is set.');
                    }
                    return args;
                };
                // override unshift
                //
                // when using the windowsVerbatimArguments option, Node does not quote the tool path when building
                // the cmdline parameter for the win32 function CreateProcess(). an unquoted space in the tool path
                // causes problems for tools when attempting to parse their own command line args. tools typically
                // assume their arguments begin after arg 0.
                //
                // by hijacking unshift, we can quote the tool path when it pushed onto the args array. Node builds
                // the cmdline parameter from the args array.
                //
                // note, we can't simply pass a quoted tool path to Node for multiple reasons:
                //   1) Node verifies the file exists (calls win32 function GetFileAttributesW) and the check returns
                //      false if the path is quoted.
                //   2) Node passes the tool path as the application parameter to CreateProcess, which expects the
                //      path to be unquoted.
                //
                // also note, in addition to the tool path being embedded within the cmdline parameter, Node also
                // passes the tool path to CreateProcess via the application parameter (optional parameter). when
                // present, Windows uses the application parameter to determine which file to run, instead of
                // interpreting the file from the cmdline parameter.
                args.unshift = function () {
                    if (arguments.length != 1) {
                        throw new Error('Unexpected arguments passed to args.unshift when windowsVerbatimArguments flag is set.');
                    }
                    return Array.prototype.unshift.call(args, `"${arguments[0]}"`); // quote the file name
                };
                return args;
            }
        }
        return this.args;
    }
    _isCmdFile() {
        let upperToolPath = this.toolPath.toUpperCase();
        return _endsWith(upperToolPath, '.CMD') || _endsWith(upperToolPath, '.BAT');
    }
    _windowsQuoteCmdArg(arg) {
        // for .exe, apply the normal quoting rules that libuv applies
        if (!this._isCmdFile()) {
            return this._uv_quote_cmd_arg(arg);
        }
        // otherwise apply quoting rules specific to the cmd.exe command line parser.
        // the libuv rules are generic and are not designed specifically for cmd.exe
        // command line parser.
        //
        // for a detailed description of the cmd.exe command line parser, refer to
        // http://stackoverflow.com/questions/4094699/how-does-the-windows-command-interpreter-cmd-exe-parse-scripts/7970912#7970912
        // need quotes for empty arg
        if (!arg) {
            return '""';
        }
        // determine whether the arg needs to be quoted
        const cmdSpecialChars = [' ', '\t', '&', '(', ')', '[', ']', '{', '}', '^', '=', ';', '!', '\'', '+', ',', '`', '~', '|', '<', '>', '"'];
        let needsQuotes = false;
        for (let char of arg) {
            if (cmdSpecialChars.some(x => x == char)) {
                needsQuotes = true;
                break;
            }
        }
        // short-circuit if quotes not needed
        if (!needsQuotes) {
            return arg;
        }
        // the following quoting rules are very similar to the rules that by libuv applies.
        //
        // 1) wrap the string in quotes
        //
        // 2) double-up quotes - i.e. " => ""
        //
        //    this is different from the libuv quoting rules. libuv replaces " with \", which unfortunately
        //    doesn't work well with a cmd.exe command line.
        //
        //    note, replacing " with "" also works well if the arg is passed to a downstream .NET console app.
        //    for example, the command line:
        //          foo.exe "myarg:""my val"""
        //    is parsed by a .NET console app into an arg array:
        //          [ "myarg:\"my val\"" ]
        //    which is the same end result when applying libuv quoting rules. although the actual
        //    command line from libuv quoting rules would look like:
        //          foo.exe "myarg:\"my val\""
        //
        // 3) double-up slashes that preceed a quote,
        //    e.g.  hello \world    => "hello \world"
        //          hello\"world    => "hello\\""world"
        //          hello\\"world   => "hello\\\\""world"
        //          hello world\    => "hello world\\"
        //
        //    technically this is not required for a cmd.exe command line, or the batch argument parser.
        //    the reasons for including this as a .cmd quoting rule are:
        //
        //    a) this is optimized for the scenario where the argument is passed from the .cmd file to an
        //       external program. many programs (e.g. .NET console apps) rely on the slash-doubling rule.
        //
        //    b) it's what we've been doing previously (by deferring to node default behavior) and we
        //       haven't heard any complaints about that aspect.
        //
        // note, a weakness of the quoting rules chosen here, is that % is not escaped. in fact, % cannot be
        // escaped when used on the command line directly - even though within a .cmd file % can be escaped
        // by using %%.
        //
        // the saving grace is, on the command line, %var% is left as-is if var is not defined. this contrasts
        // the line parsing rules within a .cmd file, where if var is not defined it is replaced with nothing.
        //
        // one option that was explored was replacing % with ^% - i.e. %var% => ^%var^%. this hack would
        // often work, since it is unlikely that var^ would exist, and the ^ character is removed when the
        // variable is used. the problem, however, is that ^ is not removed when %* is used to pass the args
        // to an external program.
        //
        // an unexplored potential solution for the % escaping problem, is to create a wrapper .cmd file.
        // % can be escaped within a .cmd file.
        let reverse = '"';
        let quote_hit = true;
        for (let i = arg.length; i > 0; i--) { // walk the string in reverse
            reverse += arg[i - 1];
            if (quote_hit && arg[i - 1] == '\\') {
                reverse += '\\'; // double the slash
            }
            else if (arg[i - 1] == '"') {
                quote_hit = true;
                reverse += '"'; // double the quote
            }
            else {
                quote_hit = false;
            }
        }
        reverse += '"';
        return reverse.split('').reverse().join('');
    }
    _uv_quote_cmd_arg(arg) {
        // Tool runner wraps child_process.spawn() and needs to apply the same quoting as
        // Node in certain cases where the undocumented spawn option windowsVerbatimArguments
        // is used.
        //
        // Since this function is a port of quote_cmd_arg from Node 4.x (technically, lib UV,
        // see https://github.com/nodejs/node/blob/v4.x/deps/uv/src/win/process.c for details),
        // pasting copyright notice from Node within this function:
        //
        //      Copyright Joyent, Inc. and other Node contributors. All rights reserved.
        //
        //      Permission is hereby granted, free of charge, to any person obtaining a copy
        //      of this software and associated documentation files (the "Software"), to
        //      deal in the Software without restriction, including without limitation the
        //      rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
        //      sell copies of the Software, and to permit persons to whom the Software is
        //      furnished to do so, subject to the following conditions:
        //
        //      The above copyright notice and this permission notice shall be included in
        //      all copies or substantial portions of the Software.
        //
        //      THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
        //      IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
        //      FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
        //      AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
        //      LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
        //      FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
        //      IN THE SOFTWARE.
        if (!arg) {
            // Need double quotation for empty argument
            return '""';
        }
        if (arg.indexOf(' ') < 0 && arg.indexOf('\t') < 0 && arg.indexOf('"') < 0) {
            // No quotation needed
            return arg;
        }
        if (arg.indexOf('"') < 0 && arg.indexOf('\\') < 0) {
            // No embedded double quotes or backslashes, so I can just wrap
            // quote marks around the whole thing.
            return `"${arg}"`;
        }
        // Expected input/output:
        //   input : hello"world
        //   output: "hello\"world"
        //   input : hello""world
        //   output: "hello\"\"world"
        //   input : hello\world
        //   output: hello\world
        //   input : hello\\world
        //   output: hello\\world
        //   input : hello\"world
        //   output: "hello\\\"world"
        //   input : hello\\"world
        //   output: "hello\\\\\"world"
        //   input : hello world\
        //   output: "hello world\\" - note the comment in libuv actually reads "hello world\"
        //                             but it appears the comment is wrong, it should be "hello world\\"
        let reverse = '"';
        let quote_hit = true;
        for (let i = arg.length; i > 0; i--) { // walk the string in reverse
            reverse += arg[i - 1];
            if (quote_hit && arg[i - 1] == '\\') {
                reverse += '\\';
            }
            else if (arg[i - 1] == '"') {
                quote_hit = true;
                reverse += '\\';
            }
            else {
                quote_hit = false;
            }
        }
        reverse += '"';
        return reverse.split('').reverse().join('');
    }
    _cloneExecOptions(options) {
        options = options || {};
        let result = {
            cwd: options.cwd || process.cwd(),
            env: options.env || process.env,
            silent: options.silent || false,
            failOnStdErr: options.failOnStdErr || false,
            ignoreReturnCode: options.ignoreReturnCode || false,
            windowsVerbatimArguments: options.windowsVerbatimArguments || false
        };
        result.outStream = options.outStream || process.stdout;
        result.errStream = options.errStream || process.stderr;
        return result;
    }
    _getSpawnSyncOptions(options) {
        let result = {};
        result.cwd = options.cwd;
        result.env = options.env;
        result['windowsVerbatimArguments'] = options.windowsVerbatimArguments || this._isCmdFile();
        return result;
    }
    /**
     * Add argument
     * Append an argument or an array of arguments
     * returns ToolRunner for chaining
     *
     * @param     val        string cmdline or array of strings
     * @returns   ToolRunner
     */
    arg(val) {
        if (!val) {
            return this;
        }
        if (val instanceof Array) {
            console.log("##[debug]" + this.toolPath + ' arg: ' + JSON.stringify(val));
            this.args = this.args.concat(val);
        }
        else if (typeof (val) === 'string') {
            console.log("##[debug]" + this.toolPath + ' arg: ' + val);
            this.args = this.args.concat(val.trim());
        }
        return this;
    }
    /**
     * Parses an argument line into one or more arguments
     * e.g. .line('"arg one" two -z') is equivalent to .arg(['arg one', 'two', '-z'])
     * returns ToolRunner for chaining
     *
     * @param     val        string argument line
     * @returns   ToolRunner
     */
    line(val) {
        if (!val) {
            return this;
        }
        console.log("##[debug]" + this.toolPath + ' arg: ' + val);
        this.args = this.args.concat(this._argStringToArray(val));
        return this;
    }
    /**
     * Exec a tool synchronously.
     * Output will be *not* be streamed to the live console.  It will be returned after execution is complete.
     * Appropriate for short running tools
     * Returns IExecSyncResult with output and return code
     *
     * @param     tool     path to tool to exec
     * @param     options  optional exec options.  See IExecSyncOptions
     * @returns   IExecSyncResult
     */
    execSync(options) {
        console.log('##[debug]exec tool: ' + this.toolPath);
        console.log('##[debug]arguments:');
        this.args.forEach((arg) => {
            console.log('##[debug]   ' + arg);
        });
        var success = true;
        options = this._cloneExecOptions(options);
        if (!options.silent) {
            options.outStream.write(this._getCommandString(options) + os.EOL);
        }
        var r = child.spawnSync(this._getSpawnFileName(), this._getSpawnArgs(options), this._getSpawnSyncOptions(options));
        if (!options.silent && r.stdout && r.stdout.length > 0) {
            options.outStream.write(r.stdout);
        }
        if (!options.silent && r.stderr && r.stderr.length > 0) {
            options.errStream.write(r.stderr);
        }
        var res = { code: r.status, error: r.error };
        res.stdout = (r.stdout) ? r.stdout.toString() : '';
        res.stderr = (r.stderr) ? r.stderr.toString() : '';
        return res;
    }
}
