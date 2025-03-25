/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import invariant from "tiny-warning";
import { FieldConfig, FieldInputProps, FieldMetaProps, FormikContextType, FormikProps, GenericFieldHTMLAttributes, connect, getIn, isEmptyChildren, isFunction } from "formik";
import isEqual from "../../../common/bones/isEqual";

type $FixMe = any;

interface FastFieldProps<V = any> {
  field: FieldInputProps<V>;
  meta: FieldMetaProps<V>;
  form: FormikProps<V>; // if ppl want to restrict this for a given form, let them.
}

type FastFieldConfig<T> = FieldConfig & {
  /** Override FastField's default shouldComponentUpdate */
  shouldUpdate?: (nextProps: T & GenericFieldHTMLAttributes, props: $FixMe) => boolean;
};

type FastFieldAttributes<T> = GenericFieldHTMLAttributes & FastFieldConfig<T> & T;

type FastFieldInnerProps<Values = $FixMe, Props = $FixMe> = FastFieldAttributes<Props> & {
  formik: FormikContextType<Values>;
  params?: any;
};

/**
 * Custom Field component for quickly hooking into Formik
 * context and wiring up forms.
 */
class FastFieldInner<Values = $FixMe, Props = $FixMe> extends React.Component<FastFieldInnerProps<Values, Props>, $FixMe> {
  constructor(props: FastFieldInnerProps<Values, Props>) {
    super(props);
    const { render, children, component, as: is, name } = props;
    invariant(!render, `<FastField render> has been deprecated. Please use a child callback function instead: <FastField name={${name}}>{props => ...}</FastField> instead.`);
    invariant(!(component && render), "You should not use <FastField component> and <FastField render> in the same <FastField> component; <FastField component> will be ignored");

    invariant(!(is && children && isFunction(children)), "You should not use <FastField as> and <FastField children> as a function in the same <FastField> component; <FastField as> will be ignored.");

    invariant(
      !(component && children && isFunction(children)),
      "You should not use <FastField component> and <FastField children> as a function in the same <FastField> component; <FastField component> will be ignored."
    );

    invariant(
      !(render && children && !isEmptyChildren(children)),
      "You should not use <FastField render> and <FastField children> in the same <FastField> component; <FastField children> will be ignored"
    );
  }

  shouldComponentUpdate(props: FastFieldInnerProps<Values, Props>) {
    if (this.props.shouldUpdate) {
      return this.props.shouldUpdate(props, this.props);
    }
    const shouldUpdate =
      props.name !== this.props.name ||
      getIn(props.formik.values, this.props.name) !== getIn(this.props.formik.values, this.props.name) ||
      getIn(props.formik.errors, this.props.name) !== getIn(this.props.formik.errors, this.props.name) ||
      getIn(props.formik.touched, this.props.name) !== getIn(this.props.formik.touched, this.props.name) ||
      !isEqual(this.props.params, props.params) ||
      Object.keys(this.props).length !== Object.keys(props).length ||
      props.formik.isSubmitting !== this.props.formik.isSubmitting;

    return shouldUpdate;
  }

  componentDidMount() {
    // Register the Field with the parent Formik. Parent will cycle through
    // registered Field's validate fns right prior to submit
    this.props.formik.registerField(this.props.name, {
      validate: this.props.validate,
    });
  }

  componentDidUpdate(prevProps: FastFieldAttributes<Props>) {
    if (this.props.name !== prevProps.name) {
      this.props.formik.unregisterField(prevProps.name);
      this.props.formik.registerField(this.props.name, {
        validate: this.props.validate,
      });
    }

    if (this.props.validate !== prevProps.validate) {
      this.props.formik.registerField(this.props.name, {
        validate: this.props.validate,
      });
    }
  }

  componentWillUnmount() {
    this.props.formik.unregisterField(this.props.name);
  }

  render() {
    const { validate, name, render, as: is, children, component, shouldUpdate, formik, ...props } = this.props as FastFieldInnerProps<Values, Props>;

    const { validate: _validate, validationSchema: _validationSchema, ...restOfFormik } = formik;
    const field = formik.getFieldProps({ name, ...props });
    const meta = {
      value: getIn(formik.values, name),
      error: getIn(formik.errors, name),
      touched: !!getIn(formik.touched, name),
      initialValue: getIn(formik.initialValues, name),
      initialTouched: !!getIn(formik.initialTouched, name),
      initialError: getIn(formik.initialErrors, name),
    };

    const bag = { field, meta, form: restOfFormik };

    if (render) {
      return (render as any)(bag);
    }

    if (isFunction(children)) {
      return (children as (props: FastFieldProps<Values>) => React.ReactNode)(bag);
    }

    if (component) {
      // This behavior is backwards compat with earlier Formik 0.9 to 1.x
      if (typeof component === "string") {
        const { innerRef, ...rest } = props;
        return React.createElement(component, { ref: innerRef, ...field, ...(rest as $FixMe) }, children);
      }
      // We don't pass `meta` for backwards compat
      return React.createElement(component as React.ComponentClass<$FixMe>, { field, form: formik, ...props }, children);
    }

    // default to input here so we can check for both `as` and `children` above
    const asElement = is || "input";

    if (typeof asElement === "string") {
      const { innerRef, ...rest } = props;
      return React.createElement(asElement, { ref: innerRef, ...field, ...(rest as $FixMe) }, children);
    }

    return React.createElement(asElement as React.ComponentClass, { ...field, ...props }, children);
  }
}

const FastField = connect<FastFieldAttributes<any>, any>(FastFieldInner);

export default FastField;
