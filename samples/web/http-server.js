
/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from "fs";
import http from "http";
import path from "path";
import url from "url";
import dotenv from "dotenv";

// Local port for http server to listen on
const PORT = 9000;

// Load environment variables from .env file
dotenv.config();

// Get your API key from https://makersuite.google.com/app/apikey
// Access your API key as an environment variable
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set. Please set it in your .env file.");
}

// Maps file extention to MIME types
// Full list can be found here: https://www.freeformatter.com/mime-types-list.html
const mimeType = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
};

http
  .createServer((req, res) => {
    console.log(`  ${req.method} ${req.url}`);

    // Parse URL
    const parsedUrl = url.parse(req.url);

    // Extract URL path
    // Avoid https://en.wikipedia.org/wiki/Directory_traversal_attack
    let sanitizedPath = path
      .normalize(parsedUrl.pathname)
      .replace(/^(\.\.[\/\\])+/, "")
      .substring(1);

    if (sanitizedPath === "API_KEY") {
      res.end(API_KEY);
      return;
    }

    if (sanitizedPath === "") {
      sanitizedPath = "index.html";
    }

    // based on the URL path, extract the file extention. e.g. .js, .doc, ...
    const ext = path.parse(sanitizedPath).ext;

    try {
      const data = fs.readFileSync(sanitizedPath);

      // If the file is found, set Content-Type and send data
      if (mimeType[ext]) {
        res.setHeader("Content-Type", mimeType[ext]);
      }
      res.end(data);
    } catch (err) {
      // If the file is not found, return 404
      res.statusCode = 404;
      res.end();
    }
  })
  .listen(parseInt(PORT));

console.log(
  `Server listening. Pages:\n - http://localhost:${PORT}\n - http://localhost:${PORT}/chat.html`,
);
