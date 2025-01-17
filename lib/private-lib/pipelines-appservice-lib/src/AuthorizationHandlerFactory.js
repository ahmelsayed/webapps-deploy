"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const AzureEndpoint_1 = require("./ArmRest/AzureEndpoint");
const AzCliAuthHandler_1 = require("./ArmRest/AzCliAuthHandler");
const utilityHelperFunctions_1 = require("./Utilities/utilityHelperFunctions");
const packageUtility_1 = require("./Utilities/packageUtility");
const Constants = __importStar(require("./constants"));
exports.authFilePath = "/home/auth.json";
function getHandler() {
    let resultOfExec = utilityHelperFunctions_1.execSync("az", "account show --query \"id\"", { silent: true });
    if (resultOfExec.code == Constants.TOOL_EXEC_CODE.SUCCESS) {
        let subscriptionId = resultOfExec.stdout.trim();
        return AzCliAuthHandler_1.AzCliAuthHandler.getEndpoint(subscriptionId.substring(1, subscriptionId.length - 1));
    }
    else if (packageUtility_1.exist(exports.authFilePath)) {
        return AzureEndpoint_1.AzureEndpoint.getEndpoint(exports.authFilePath);
    }
    else {
        throw new Error("No credentials found. Please provide Publish Profile path or add a azure login script before this action or put credentials file in /home/auth.json.");
    }
}
exports.getHandler = getHandler;
