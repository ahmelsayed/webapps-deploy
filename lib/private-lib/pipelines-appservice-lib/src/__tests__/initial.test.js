"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utility_1 = require("../Utilities/utility");
test('File name', () => {
    expect(utility_1.getFileNameFromPath("abc/def/hello.zip", ".zip")).toBe("hello");
});
