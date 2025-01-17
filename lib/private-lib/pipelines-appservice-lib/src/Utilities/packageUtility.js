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
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const utility = require("./utility");
const zipUtility = require("./ziputility");
var PackageType;
(function (PackageType) {
    PackageType[PackageType["war"] = 0] = "war";
    PackageType[PackageType["zip"] = 1] = "zip";
    PackageType[PackageType["jar"] = 2] = "jar";
    PackageType[PackageType["folder"] = 3] = "folder";
})(PackageType = exports.PackageType || (exports.PackageType = {}));
class PackageUtility {
    static getPackagePath(packagePath) {
        var availablePackages = utility.findfiles(packagePath);
        if (availablePackages.length == 0) {
            throw new Error('No package found with specified pattern: ' + packagePath);
        }
        if (availablePackages.length > 1) {
            throw new Error('More than one package matched with specified pattern: ' + packagePath + '. Please restrain the search pattern.');
        }
        return availablePackages[0];
    }
}
exports.PackageUtility = PackageUtility;
class Package {
    constructor(packagePath) {
        this._path = PackageUtility.getPackagePath(packagePath);
        this._isMSBuildPackage = undefined;
    }
    getPath() {
        return this._path;
    }
    isMSBuildPackage() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._isMSBuildPackage == undefined) {
                this._isMSBuildPackage = this.getPackageType() != PackageType.folder && (yield zipUtility.checkIfFilesExistsInZip(this._path, ["parameters.xml", "systeminfo.xml"]));
                console.log("Is the package an msdeploy package : " + this._isMSBuildPackage);
            }
            return this._isMSBuildPackage;
        });
    }
    getPackageType() {
        if (this._packageType == undefined) {
            if (!exist(this._path)) {
                throw new Error('Invalidwebapppackageorfolderpathprovided' + this._path);
            }
            else {
                if (this._path.toLowerCase().endsWith('.war')) {
                    this._packageType = PackageType.war;
                    console.log("This is war package ");
                }
                else if (this._path.toLowerCase().endsWith('.jar')) {
                    this._packageType = PackageType.jar;
                    console.log("This is jar package ");
                }
                else if (this._path.toLowerCase().endsWith('.zip')) {
                    this._packageType = PackageType.zip;
                    console.log("This is zip package ");
                }
                else if (fs.statSync(this._path).isDirectory()) {
                    this._packageType = PackageType.folder;
                    console.log("This is folder package ");
                }
                else {
                    throw new Error('Invalidwebapppackageorfolderpathprovided' + this._path);
                }
            }
        }
        return this._packageType;
    }
}
exports.Package = Package;
function exist(path) {
    var exist = false;
    try {
        exist = path && fs.statSync(path) != null;
    }
    catch (err) {
        if (err && err.code === 'ENOENT') {
            exist = false;
        }
        else {
            throw err;
        }
    }
    return exist;
}
exports.exist = exist;
