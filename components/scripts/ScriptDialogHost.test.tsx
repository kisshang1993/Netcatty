import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ScriptDialogRequest } from "../../types/global/netcatty-bridge-script.d.ts";
import {
  applyFormValue,
  getInitialFormValues,
  normalizeDialogFormSubmitValues,
  ScriptDialogFormFields,
  validateDialogFormValues,
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
      {
        type: "textarea",
        name: "notes",
        label: "Notes",
        defaultValue: "initial note",
        required: false,
      },
      {
        type: "number",
        name: "retries",
        label: "Retries",
        defaultValue: 3,
        min: 0,
        step: 1,
      },
    ],
  },
};

test("script dialog form derives initial values from fields", () => {
  assert.deepEqual(getInitialFormValues(formRequest), {
    env: "dev",
    restart: true,
    mode: "safe",
    notes: "initial note",
    retries: 3,
  });
});

test("script dialog form value helper preserves previous values for submit payload", () => {
  const initial = getInitialFormValues(formRequest);
  const withEnv = applyFormValue(initial, "env", "prod");
  const withRestart = applyFormValue(withEnv, "restart", false);
  const withMode = applyFormValue(withRestart, "mode", "fast");
  const withNotes = applyFormValue(withMode, "notes", "ship it");
  const submitted = normalizeDialogFormSubmitValues(
    formRequest.form!,
    applyFormValue(withNotes, "retries", "5"),
  );

  assert.deepEqual(submitted, {
    env: "prod",
    restart: false,
    mode: "fast",
    notes: "ship it",
    retries: 5,
  });
});

test("script dialog form validates required text and number fields", () => {
  const emptyRequiredRequest: ScriptDialogRequest = {
    ...formRequest,
    form: {
      ...formRequest.form!,
      fields: [
        ...formRequest.form!.fields,
        { type: "textarea", name: "requiredNotes", label: "Required notes", defaultValue: "" },
        { type: "number", name: "requiredCount", label: "Required count" },
      ],
    },
  };
  const values = getInitialFormValues(emptyRequiredRequest);

  assert.deepEqual(validateDialogFormValues(emptyRequiredRequest.form!, values, "Required"), {
    requiredNotes: "Required",
    requiredCount: "Required",
  });
});

test("script dialog form validates number min max and step before submit", () => {
  const form = {
    message: "Number limits",
    fields: [{
      type: "number" as const,
      name: "delayMs",
      label: "Delay",
      defaultValue: 500,
      min: 0,
      max: 5000,
      step: 100,
      required: false,
    }],
  };
  const messages = {
    required: "Required",
    numberInvalid: "Invalid",
    numberMin: (min: number) => `Min ${min}`,
    numberMax: (max: number) => `Max ${max}`,
    numberStep: (step: number) => `Step ${step}`,
  };

  assert.deepEqual(validateDialogFormValues(form, { delayMs: -1 }, messages), {
    delayMs: "Min 0",
  });
  assert.deepEqual(validateDialogFormValues(form, { delayMs: 5001 }, messages), {
    delayMs: "Max 5000",
  });
  assert.deepEqual(validateDialogFormValues(form, { delayMs: 550 }, messages), {
    delayMs: "Step 100",
  });
  assert.deepEqual(validateDialogFormValues(form, { delayMs: "" }, messages), {});
  assert.deepEqual(validateDialogFormValues(form, { delayMs: 5000 }, messages), {});
});

test("script dialog form fields render select checkbox radio textarea and number controls", () => {
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
  assert.match(markup, /<textarea[^>]*>initial note<\/textarea>/);
  assert.match(markup, /type="number"[^>]*min="0"[^>]*step="1"[^>]*value="3"/);
});

test("script dialog form fields render required errors", () => {
  const values = getInitialFormValues(formRequest);
  const markup = renderToStaticMarkup(
    <ScriptDialogFormFields
      form={formRequest.form!}
      formValues={values}
      formErrors={{ retries: "Required" }}
      onValueChange={() => {}}
    />,
  );

  assert.match(markup, /aria-invalid="true"/);
  assert.match(markup, /Required/);
});
