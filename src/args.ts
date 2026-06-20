import { parseArgs as parseNodeArgs } from "node:util";

type InstallFlowOptions = {
  createQuaffSource?: string;
  headed: boolean;
  keep: boolean;
  quaffSource?: string;
};

export function parseArgs(argv: string[]) {
  const { values } = parseNodeArgs({
    args: argv,
    allowPositionals: false,
    options: {
      "create-quaff-source": { type: "string" },
      headed: { type: "boolean" },
      keep: { type: "boolean" },
      "quaff-source": { type: "string" },
    },
  });

  const options: InstallFlowOptions = {
    headed: values.headed === true,
    keep: values.keep === true,
  };

  if (typeof values["create-quaff-source"] === "string") {
    options.createQuaffSource = values["create-quaff-source"];
  }

  if (typeof values["quaff-source"] === "string") {
    options.quaffSource = values["quaff-source"];
  }

  return options;
}
