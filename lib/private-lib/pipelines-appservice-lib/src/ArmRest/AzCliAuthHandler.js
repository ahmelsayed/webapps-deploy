"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utilityHelperFunctions_1 = require("../Utilities/utilityHelperFunctions");
class AzCliAuthHandler {
    constructor(subscriptionID) {
        this._subscriptionID = subscriptionID;
        this._baseUrl = "https://management.azure.com/";
    }
    static getEndpoint(param) {
        if (!this.endpoint) {
            this.endpoint = new AzCliAuthHandler(param);
        }
        return this.endpoint;
    }
    get subscriptionID() {
        return this._subscriptionID;
    }
    get baseUrl() {
        return this._baseUrl;
    }
    getToken(force) {
        if (!this.token || force) {
            let resultOfExec = utilityHelperFunctions_1.execSync("az", "account get-access-token --query \"accessToken\"", { silent: true });
            if (resultOfExec.code != 0) {
                console.log("##[error]Error Code: [" + resultOfExec.code + "]");
                throw resultOfExec;
            }
            let tok = resultOfExec.stdout.trim();
            this.token = tok.substring(1, tok.length - 1);
        }
        return this.token;
    }
}
exports.AzCliAuthHandler = AzCliAuthHandler;
