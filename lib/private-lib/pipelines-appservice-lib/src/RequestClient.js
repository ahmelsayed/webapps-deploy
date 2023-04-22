"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const HttpClient_1 = require("typed-rest-client/HttpClient");
class RequestClient {
    constructor() {
        // Singleton pattern: block from public construction
    }
    static GetInstance() {
        if (RequestClient._instance === undefined) {
            RequestClient._instance = new HttpClient_1.HttpClient(`${process.env.AZURE_HTTP_USER_AGENT}`, undefined, RequestClient._options);
        }
        return RequestClient._instance;
    }
    static SetOptions(newOptions) {
        RequestClient._options = newOptions;
    }
}
exports.RequestClient = RequestClient;
RequestClient._options = {};
