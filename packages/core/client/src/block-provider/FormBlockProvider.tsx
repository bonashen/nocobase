import { createForm } from '@formily/core';
import { RecursionField, Schema, useField, useFieldSchema } from '@formily/react';
import { Spin } from 'antd';
import _, { isEmpty } from 'lodash';
import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { useCollection } from '../collection-manager';
import { RecordProvider, useRecord } from '../record-provider';
import { useActionContext, useDesignable } from '../schema-component';
import { Templates as DataTemplateSelect } from '../schema-component/antd/form-v2/Templates';
import { BlockProvider, useBlockRequestContext } from './BlockProvider';
import { FormActiveFieldsProvider } from './hooks';

export const FormBlockContext = createContext<any>({});

const InternalFormBlockProvider = (props) => {
  const { action, readPretty, params, association } = props;
  const field = useField();
  const form = useMemo(
    () =>
      createForm({
        readPretty,
      }),
    [readPretty],
  );
  const { resource, service, updateAssociationValues } = useBlockRequestContext();
  const formBlockRef = useRef();
  const record = useRecord();
  const formBlockValue = useMemo(() => {
    return {
      params,
      action,
      form,
      // update 表示是表单编辑区块，create 表示是表单新增区块
      type: action === 'get' ? 'update' : 'create',
      field,
      service,
      resource,
      updateAssociationValues,
      formBlockRef,
    };
  }, [action, field, form, params, resource, service, updateAssociationValues]);

  if (service.loading && Object.keys(form?.initialValues)?.length === 0 && action) {
    return <Spin />;
  }

  let content = (
    <div ref={formBlockRef}>
      <RenderChildrenWithDataTemplates form={form} />
    </div>
  );
  if (readPretty) {
    content = (
      <RecordProvider parent={isEmpty(record?.__parent) ? record : record?.__parent} record={service?.data?.data}>
        {content}
      </RecordProvider>
    );
  } else if (
    formBlockValue.type === 'create' &&
    // 点击关系表格区块的 Add new 按钮，在弹窗中新增的表单区块，是不需要重置 record 的。在这里用 record 是否为空来判断
    !_.isEmpty(_.omit(record, ['__parent', '__collectionName'])) &&
    // association 不为空，说明是关系区块
    association
  ) {
    content = (
      <RecordProvider parent={record} record={{}}>
        {content}
      </RecordProvider>
    );
  }

  return <FormBlockContext.Provider value={formBlockValue}>{content}</FormBlockContext.Provider>;
};

/**
 * 获取表单区块的类型：update 表示是表单编辑区块，create 表示是表单新增区块
 * @returns
 */
export const useFormBlockType = () => {
  const ctx = useFormBlockContext() || {};
  return { type: ctx.type } as { type: 'update' | 'create' };
};

export const useIsEmptyRecord = () => {
  const record = useRecord();
  const keys = Object.keys(record);
  if (keys.includes('__parent')) {
    return keys.length > 1;
  }
  return keys.length > 0;
};

export const FormBlockProvider = (props) => {
  const record = useRecord();
  const { collection, isCusomeizeCreate } = props;
  const { __collection } = record;
  const currentCollection = useCollection();
  const { designable } = useDesignable();
  const isEmptyRecord = useIsEmptyRecord();
  let detailFlag = false;
  if (isEmptyRecord) {
    detailFlag = true;
    if (!designable && __collection) {
      detailFlag = __collection === collection;
    }
  }
  const createFlag =
    (currentCollection.name === (collection?.name || collection) && !isEmptyRecord) || !currentCollection.name;
  return (
    (detailFlag || createFlag || isCusomeizeCreate) && (
      <BlockProvider data-testid={props['data-testid'] || 'form-block'} {...props} block={'form'}>
        <FormActiveFieldsProvider name="form">
          <InternalFormBlockProvider {...props} />
        </FormActiveFieldsProvider>
      </BlockProvider>
    )
  );
};

export const useFormBlockContext = () => {
  return useContext(FormBlockContext);
};

export const useFormBlockProps = () => {
  const ctx = useFormBlockContext();
  const record = useRecord();
  const { fieldSchema } = useActionContext();
  const addChild = fieldSchema?.['x-component-props']?.addChild;
  useEffect(() => {
    if (addChild) {
      ctx.form?.query('parent').take((field) => {
        field.disabled = true;
        field.value = new Proxy({ ...record }, {});
      });
    }
  });

  useEffect(() => {
    if (!ctx?.service?.loading) {
      ctx.form?.setInitialValues(ctx.service?.data?.data);
    }
  }, [ctx?.service?.loading]);
  return {
    form: ctx.form,
  };
};

const RenderChildrenWithDataTemplates = ({ form }) => {
  const FieldSchema = useFieldSchema();
  const { findComponent } = useDesignable();
  const field = useField();
  const Component = findComponent(field.component?.[0]) || React.Fragment;
  return (
    <Component {...field.componentProps}>
      <DataTemplateSelect style={{ marginBottom: 18 }} form={form} />
      <RecursionField schema={FieldSchema} onlyRenderProperties />
    </Component>
  );
};

export const findFormBlock = (schema: Schema) => {
  while (schema) {
    if (schema['x-decorator'] === 'FormBlockProvider') {
      return schema;
    }
    schema = schema.parent;
  }
  return null;
};
