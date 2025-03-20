import { existsSync, readFile, writeFile } from "fs";

if (existsSync(process.argv[2])) {
  readFile(process.argv[2], "utf8", (e, data) => {
    writeFile("./public/config.json", data, "utf8", (err) => {
      if (err) {
        throw err;
      }
    });
  });
}
