import { useField, useFieldSchema, useForm } from '@formily/react';
import {
  TableFieldResource,
  getFormValues,
  useAPIClient,
  useActionContext,
  useBlockRequestContext,
  useCollection,
  useCompile,
  useFilterByTk,
  useFormActiveFields,
  useRecord,
} from '@nocobase/client';
import { App } from 'antd';
import { isURL } from '@nocobase/utils/client';
import { useNavigate } from 'react-router-dom';
import { useGetCustomRequest } from './useGetCustomRequest';
import { useTranslation } from '../locale';

export const useCustomizeRequestActionProps = () => {
  const apiClient = useAPIClient();
  const navigate = useNavigate();
  const filterByTk = useFilterByTk();
  const actionSchema = useFieldSchema();
  const compile = useCompile();
  const form = useForm();
  const { fields, getField, getPrimaryKey } = useCollection();
  const { field, resource, __parent, service } = useBlockRequestContext();
  const { getActiveFieldsName } = useFormActiveFields() || {};
  const record = useRecord();
  const fieldSchema = useFieldSchema();
  const { data, runAsync } = useGetCustomRequest();
  const actionField = useField();
  const { setVisible } = useActionContext();
  const { modal, message } = App.useApp();
  const { t } = useTranslation();

  return {
    async onClick() {
      const { skipValidator, onSuccess } = actionSchema?.['x-action-settings'] ?? {};
      const options = data ? data?.data?.options : (await runAsync())?.data?.options;
      if (!options?.['url']) {
        return message.error(t('Please configure the request settings first'));
      }
      const xAction = actionSchema?.['x-action'];
      if (skipValidator !== true && xAction === 'customize:form:request') {
        await form.submit();
      }

      let formValues = {};
      const methods = ['POST', 'PUT', 'PATCH'];
      if (xAction === 'customize:form:request' && methods.includes(options['method'])) {
        const fieldNames = fields.map((field) => field.name);
        const values = getFormValues({
          filterByTk,
          field,
          form,
          fieldNames,
          getField,
          resource,
          actionFields: getActiveFieldsName?.('form') || [],
        });
        formValues = values;
      }

      actionField.data ??= {};
      actionField.data.loading = true;
      try {
        await apiClient.request({
          url: `/customRequests:send/${fieldSchema['x-uid']}`,
          method: 'POST',
          data: {
            currentRecord: {
              id: record[getPrimaryKey()],
              appends: service.params[0].appends,
              data: formValues,
            },
          },
        });
        actionField.data.loading = false;
        if (!(resource instanceof TableFieldResource)) {
          __parent?.service?.refresh?.();
        }
        service?.refresh?.();
        if (xAction === 'customize:form:request') {
          setVisible?.(false);
        }
        if (!onSuccess?.successMessage) {
          return;
        }
        if (onSuccess?.manualClose) {
          modal.success({
            title: compile(onSuccess?.successMessage),
            onOk: async () => {
              if (onSuccess?.redirecting && onSuccess?.redirectTo) {
                if (isURL(onSuccess.redirectTo)) {
                  window.location.href = onSuccess.redirectTo;
                } else {
                  navigate(onSuccess.redirectTo);
                }
              }
            },
          });
        } else {
          return message.success(compile(onSuccess?.successMessage));
        }
      } finally {
        actionField.data.loading = false;
      }
    },
  };
};
