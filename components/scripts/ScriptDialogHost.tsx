import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/application/i18n/I18nProvider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { netcattyBridge } from '@/infrastructure/services/netcattyBridge.ts';
import type {
  ScriptDialogField,
  ScriptDialogForm,
  ScriptDialogFormValue,
  ScriptDialogRequest,
} from '@/types/global/netcatty-bridge-script.d.ts';

type FormValues = Record<string, ScriptDialogFormValue>;

export function getInitialFormValues(request: ScriptDialogRequest): FormValues {
  if (request.type !== 'form' || !request.form) return {};
  return Object.fromEntries(
    request.form.fields.map((field) => [field.name, field.defaultValue]),
  );
}

export function applyFormValue(values: FormValues, name: string, value: ScriptDialogFormValue): FormValues {
  return { ...values, [name]: value };
}

export function ScriptDialogFormFields({
  form,
  formValues,
  onValueChange,
}: {
  form: ScriptDialogForm;
  formValues: FormValues;
  onValueChange: (name: string, value: ScriptDialogFormValue) => void;
}) {
  const renderFormField = (field: ScriptDialogField) => {
    const fieldDescription = field.description ? (
      <p className="text-xs text-muted-foreground">{field.description}</p>
    ) : null;

    if (field.type === 'select') {
      return (
        <div key={field.name} className="space-y-2">
          <Label>{field.label}</Label>
          <Select
            value={String(formValues[field.name] ?? field.defaultValue)}
            onValueChange={(value) => onValueChange(field.name, value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldDescription}
        </div>
      );
    }

    if (field.type === 'radio') {
      const selectedValue = String(formValues[field.name] ?? field.defaultValue);
      return (
        <fieldset key={field.name} className="space-y-2">
          <legend className="text-sm font-medium leading-none">{field.label}</legend>
          {fieldDescription}
          <div className="space-y-2">
            {field.options.map((option, index) => {
              const inputId = `script-dialog-${field.name}-${index}`;
              return (
                <label
                  key={option.value}
                  htmlFor={inputId}
                  className="flex items-start gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
                >
                  <input
                    id={inputId}
                    type="radio"
                    name={`script-dialog-${field.name}`}
                    value={option.value}
                    checked={selectedValue === option.value}
                    disabled={option.disabled}
                    onChange={(event) => onValueChange(field.name, event.target.value)}
                    className="mt-0.5 h-4 w-4 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block">{option.label}</span>
                    {option.description ? (
                      <span className="block text-xs text-muted-foreground">{option.description}</span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      );
    }

    const inputId = `script-dialog-${field.name}`;
    return (
      <div key={field.name} className="space-y-2">
        <label htmlFor={inputId} className="flex items-start gap-2 text-sm">
          <input
            id={inputId}
            type="checkbox"
            checked={Boolean(formValues[field.name] ?? field.defaultValue)}
            onChange={(event) => onValueChange(field.name, event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span className="min-w-0">
            <span className="block font-medium leading-none">{field.label}</span>
            {field.description ? (
              <span className="mt-1 block text-xs text-muted-foreground">{field.description}</span>
            ) : null}
          </span>
        </label>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {form.fields.map(renderFormField)}
    </div>
  );
}

export function ScriptDialogHost() {
  const { t } = useI18n();
  const [request, setRequest] = useState<ScriptDialogRequest | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [formValues, setFormValues] = useState<FormValues>({});

  useEffect(() => {
    const dispose = netcattyBridge.get()?.onScriptDialogRequest?.((payload) => {
      setRequest(payload);
      setPromptValue(payload.defaultValue ?? '');
      setFormValues(getInitialFormValues(payload));
    });
    return dispose;
  }, []);

  const respond = useCallback(async (value?: unknown, cancelled = false) => {
    if (!request) return;
    await netcattyBridge.get()?.scriptDialogResponse?.(request.requestId, value, cancelled);
    setRequest(null);
  }, [request]);

  if (!request) return null;

  const form = request.type === 'form' ? request.form : undefined;
  const dialogTitle = request.type === 'waitForTimeout'
    ? t('scripts.dialog.waitForTimeoutTitle')
    : form?.title || t('scripts.dialog.title');
  const message = form?.message ?? request.message;

  const setFormValue = (name: string, value: ScriptDialogFormValue) => {
    setFormValues((current) => applyFormValue(current, name, value));
  };

  return (
    <Dialog open onOpenChange={(open) => {
      if (!open) {
        void respond(request.type === 'waitForTimeout' ? 'abort' : undefined, true);
      }
    }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          {message ? <DialogDescription>{message}</DialogDescription> : null}
        </DialogHeader>
        {request.type === 'prompt' ? (
          <Input
            value={promptValue}
            onChange={(event) => setPromptValue(event.target.value)}
            autoFocus
          />
        ) : null}
        {form ? (
          <ScriptDialogFormFields
            form={form}
            formValues={formValues}
            onValueChange={setFormValue}
          />
        ) : null}
        <DialogFooter>
          {request.type === 'waitForTimeout' ? (
            <>
              <Button variant="outline" onClick={() => void respond('abort')}>
                {t('scripts.dialog.abort')}
              </Button>
              <Button variant="secondary" onClick={() => void respond('skip')}>
                {t('scripts.dialog.skip')}
              </Button>
              <Button onClick={() => void respond('retry')}>
                {t('scripts.dialog.retry')}
              </Button>
            </>
          ) : request.type === 'confirm' ? (
            <>
              <Button variant="outline" onClick={() => void respond(false)}>{t('common.cancel')}</Button>
              <Button onClick={() => void respond(true)}>{t('scripts.dialog.ok')}</Button>
            </>
          ) : request.type === 'prompt' ? (
            <>
              <Button variant="outline" onClick={() => void respond(undefined, true)}>{t('common.cancel')}</Button>
              <Button onClick={() => void respond(promptValue)}>{t('scripts.dialog.ok')}</Button>
            </>
          ) : request.type === 'form' ? (
            <>
              <Button variant="outline" onClick={() => void respond(undefined, true)}>
                {form?.cancelLabel || t('common.cancel')}
              </Button>
              <Button onClick={() => void respond(formValues)}>
                {form?.submitLabel || t('scripts.dialog.ok')}
              </Button>
            </>
          ) : (
            <Button onClick={() => void respond(undefined)}>{t('scripts.dialog.ok')}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
