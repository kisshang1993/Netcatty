import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ScriptDialogRequest } from "../../types/global/netcatty-bridge-script.d.ts";
import {
  applyFormValue,
  getInitialFormValues,
  ScriptDialogFormFields,
} from "./ScriptDialogHost.tsx";

const formRequest: ScriptDialogRequest = {
  requestId: "dialog-1",
  type: "form",
  message: "Choose options",
  form: {
    title: "Deploy",
    message: "Choose options",
    fields: [
      {
        type: "select",
        name: "env",
        label: "Environment",
        options: [
          { label: "Development", value: "dev" },
          { label: "Production", value: "prod" },
        ],
        defaultValue: "dev",
      },
      {
        type: "checkbox",
        name: "restart",
        label: "Restart service",
        defaultValue: true,
      },
      {
        type: "radio",
        name: "mode",
        label: "Mode",
        options: [
          { label: "Safe", value: "safe" },
          { label: "Fast", value: "fast" },
        ],
        defaultValue: "safe",
      },
    ],
  },
};

test("script dialog form derives initial values from fields", () => {
  assert.deepEqual(getInitialFormValues(formRequest), {
    env: "dev",
    restart: true,
    mode: "safe",
  });
});

test("script dialog form value helper preserves previous values for submit payload", () => {
  const initial = getInitialFormValues(formRequest);
  const withEnv = applyFormValue(initial, "env", "prod");
  const withRestart = applyFormValue(withEnv, "restart", false);
  const submitted = applyFormValue(withRestart, "mode", "fast");

  assert.deepEqual(submitted, {
    env: "prod",
    restart: false,
    mode: "fast",
  });
});

test("script dialog form fields render select checkbox and radio controls", () => {
  const values = getInitialFormValues(formRequest);
  const markup = renderToStaticMarkup(
    <ScriptDialogFormFields
      form={formRequest.form!}
      formValues={values}
      onValueChange={() => {}}
    />,
  );

  assert.match(markup, /Environment/);
  assert.match(markup, /Restart service/);
  assert.match(markup, /type="checkbox"[^>]*checked=""/);
  assert.match(markup, /type="radio"[^>]*checked=""[^>]*value="safe"/);
  assert.match(markup, /type="radio"[^>]*value="fast"/);
});
