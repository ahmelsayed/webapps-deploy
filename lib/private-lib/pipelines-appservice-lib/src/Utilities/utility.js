"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const packageUtility_1 = require("./packageUtility");
const utilityHelperFunctions_1 = require("./utilityHelperFunctions");
const zipUtility = require("./ziputility");
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
function findfiles(filepath) {
    console.log("Finding files matching input: " + filepath);
    var filesList;
    if (filepath.indexOf('*') == -1 && filepath.indexOf('?') == -1) {
        // No pattern found, check literal path to a single file
        if (packageUtility_1.exist(filepath)) {
            filesList = [filepath];
        }
        else {
            console.log('No matching files were found with search pattern: ' + filepath);
            return [];
        }
    }
    else {
        var firstWildcardIndex = function (str) {
            var idx = str.indexOf('*');
            var idxOfWildcard = str.indexOf('?');
            if (idxOfWildcard > -1) {
                return (idx > -1) ?
                    Math.min(idx, idxOfWildcard) : idxOfWildcard;
            }
            return idx;
        };
        // Find app files matching the specified pattern
        console.log('Matching glob pattern: ' + filepath);
        // First find the most complete path without any matching patterns
        var idx = firstWildcardIndex(filepath);
        console.log('Index of first wildcard: ' + idx);
        var slicedPath = filepath.slice(0, idx);
        var findPathRoot = path.dirname(slicedPath);
        if (slicedPath.endsWith("\\") || slicedPath.endsWith("/")) {
            findPathRoot = slicedPath;
        }
        console.log('find root dir: ' + findPathRoot);
        // Now we get a list of all files under this root
        var allFiles = utilityHelperFunctions_1.find(findPathRoot);
        // Now matching the pattern against all files
        filesList = utilityHelperFunctions_1.match(allFiles, filepath, '', { matchBase: true, nocase: !!os.type().match(/^Win/) });
        // Fail if no matching files were found
        if (!filesList || filesList.length == 0) {
            console.log('No matching files were found with search pattern: ' + filepath);
            return [];
        }
    }
    return filesList;
}
exports.findfiles = findfiles;
function generateTemporaryFolderOrZipPath(folderPath, isFolder) {
    var randomString = Math.random().toString().split('.')[1];
    var tempPath = path.join(folderPath, 'temp_web_package_' + randomString + (isFolder ? "" : ".zip"));
    if (packageUtility_1.exist(tempPath)) {
        return generateTemporaryFolderOrZipPath(folderPath, isFolder);
    }
    return tempPath;
}
exports.generateTemporaryFolderOrZipPath = generateTemporaryFolderOrZipPath;
function copyDirectory(sourceDirectory, destDirectory) {
    if (!packageUtility_1.exist(destDirectory)) {
        utilityHelperFunctions_1.mkdirP(destDirectory);
    }
    var listSrcDirectory = utilityHelperFunctions_1.find(sourceDirectory);
    for (var srcDirPath of listSrcDirectory) {
        var relativePath = srcDirPath.substring(sourceDirectory.length);
        var destinationPath = path.join(destDirectory, relativePath);
        if (fs.statSync(srcDirPath).isDirectory()) {
            utilityHelperFunctions_1.mkdirP(destinationPath);
        }
        else {
            if (!packageUtility_1.exist(path.dirname(destinationPath))) {
                utilityHelperFunctions_1.mkdirP(path.dirname(destinationPath));
            }
            console.log('copy file from: ' + srcDirPath + ' to: ' + destinationPath);
            utilityHelperFunctions_1.cp(srcDirPath, destinationPath, '-f', false);
        }
    }
}
exports.copyDirectory = copyDirectory;
function generateTemporaryFolderForDeployment(isFolderBasedDeployment, webDeployPkg, packageType) {
    return __awaiter(this, void 0, void 0, function* () {
        var folderName = `${process.env.RUNNER_TEMP}`;
        var folderPath = generateTemporaryFolderOrZipPath(folderName, true);
        if (isFolderBasedDeployment || packageType === packageUtility_1.PackageType.jar) {
            console.log('Copying Web Packge: ' + webDeployPkg + ' to temporary location: ' + folderPath);
            copyDirectory(webDeployPkg, folderPath);
            if (packageType === packageUtility_1.PackageType.jar && this.getFileNameFromPath(webDeployPkg, ".jar") != "app") {
                let src = path.join(folderPath, getFileNameFromPath(webDeployPkg));
                let dest = path.join(folderPath, "app.jar");
                console.log("Renaming " + src + " to " + dest);
                fs.renameSync(src, dest);
            }
            console.log('Copied Web Package: ' + webDeployPkg + ' to temporary location: ' + folderPath + ' successfully.');
        }
        else {
            yield zipUtility.unzip(webDeployPkg, folderPath);
        }
        return folderPath;
    });
}
exports.generateTemporaryFolderForDeployment = generateTemporaryFolderForDeployment;
function archiveFolderForDeployment(isFolderBasedDeployment, folderPath) {
    return __awaiter(this, void 0, void 0, function* () {
        var webDeployPkg;
        if (isFolderBasedDeployment) {
            webDeployPkg = folderPath;
        }
        else {
            var tempWebPackageZip = generateTemporaryFolderOrZipPath(`${process.env.RUNNER_TEMP}`, false);
            webDeployPkg = yield zipUtility.archiveFolder(folderPath, "", tempWebPackageZip);
        }
        return {
            "webDeployPkg": webDeployPkg,
            "tempPackagePath": webDeployPkg
        };
    });
}
exports.archiveFolderForDeployment = archiveFolderForDeployment;
function getFileNameFromPath(filePath, extension) {
    var isWindows = os.type().match(/^Win/);
    var fileName;
    if (isWindows) {
        fileName = path.win32.basename(filePath, extension);
    }
    else {
        fileName = path.posix.basename(filePath, extension);
    }
    return fileName;
}
exports.getFileNameFromPath = getFileNameFromPath;
function getTempDirectory() {
    return `${process.env.RUNNER_TEMP}` || os.tmpdir();
}
exports.getTempDirectory = getTempDirectory;
