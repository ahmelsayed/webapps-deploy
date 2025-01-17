"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Q = require("q");
const fs = require("fs");
const webClient = require("../webClient");
const querystring = require("querystring");
class AzureEndpoint {
    constructor(authFilePath) {
        let content = fs.readFileSync(authFilePath).toString();
        let jsonObj = JSON.parse(content);
        this._subscriptionID = jsonObj.subscriptionId;
        this.servicePrincipalClientID = jsonObj.clientId;
        this.servicePrincipalKey = jsonObj.clientSecret;
        this.tenantID = jsonObj.tenantId;
        if (!this.subscriptionID || !this.servicePrincipalClientID || !this.servicePrincipalKey || !this.tenantID) {
            throw new Error("Not all credentail details present in file.");
        }
        this._baseUrl = "https://management.azure.com/";
        this.environmentAuthorityUrl = "https://login.windows.net/";
        this.activeDirectoryResourceId = "https://management.core.windows.net/";
    }
    static getEndpoint(authFilePath) {
        if (!this.endpoint) {
            this.endpoint = new AzureEndpoint(authFilePath);
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
        if (!this.token_deferred || force) {
            this.token_deferred = this._getSPNAuthorizationToken();
        }
        return this.token_deferred;
    }
    _getSPNAuthorizationToken() {
        var deferred = Q.defer();
        let webRequest = {
            method: "POST",
            uri: this.environmentAuthorityUrl + this.tenantID + "/oauth2/token/",
            body: querystring.stringify({
                resource: this.activeDirectoryResourceId,
                client_id: this.servicePrincipalClientID,
                grant_type: "client_credentials",
                client_secret: this.servicePrincipalKey
            }),
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=utf-8"
            }
        };
        let webRequestOptions = {
            retriableStatusCodes: [400, 408, 409, 500, 502, 503, 504]
        };
        webClient.sendRequest(webRequest, webRequestOptions).then((response) => {
            if (response.statusCode == 200) {
                deferred.resolve(response.body.access_token);
            }
            else if ([400, 401, 403].indexOf(response.statusCode) != -1) {
                deferred.reject('ExpiredServicePrincipal');
            }
            else {
                deferred.reject('CouldNotFetchAccessTokenforAzureStatusCode');
            }
        }, (error) => {
            deferred.reject(error);
        });
        return deferred.promise;
    }
}
exports.AzureEndpoint = AzureEndpoint;
