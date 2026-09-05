import { spawn } from "node:child_process";

const forwarded = process.argv.slice(2);
const args = ["dev"];

for (let index = 0; index < forwarded.length; index += 1) {
  const argument = forwarded[index];
  if (argument === "--strictPort") continue;
  if (argument === "--host") {
    args.push("--hostname", forwarded[index + 1]);
    index += 1;
    continue;
  }
  args.push(argument);
}

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", ...args], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
