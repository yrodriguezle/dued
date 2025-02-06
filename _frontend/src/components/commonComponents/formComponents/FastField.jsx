import React from 'react';
import { connect, getIn } from 'formik';
import isEqual from 'lodash/isEqual';
import { shallowCompare, typeOf } from '../../../common/formUtils';

class FastFieldInner extends React.Component {
  componentDidMount() {
    // Register the Field with the parent Formik. Parent will cycle through
    // registered Field's validate fns right prior to submit
    this.props.formik.registerField(this.props.name, {
      validate: this.props.validate,
    });
  }

  shouldComponentUpdate(props) {
    if (this.props.shouldUpdate) {
      return this.props.shouldUpdate(props, this.props);
    }
    const shouldUpdate = (
      props.name !== this.props.name
      || !isEqual(getIn(props.formik.values, this.props.name), getIn(this.props.formik.values, this.props.name))
      || getIn(props.formik.errors, this.props.name) !== getIn(this.props.formik.errors, this.props.name)
      || getIn(props.formik.touched, this.props.name) !== getIn(this.props.formik.touched, this.props.name)
      || !shallowCompare(this.props.params, props.params)
      || props.formik.isSubmitting !== this.props.formik.isSubmitting
      || !isEqual(props.formik.status, this.props.formik.status)
    );
    return shouldUpdate;
  }

  componentDidUpdate(prevProps) {
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
    const {
      validate,
      name,
      children,
      shouldUpdate,
      formik,
      ...props
    } = this.props;

    const {
      validate: _validate,
      validationSchema: _validationSchema,
      ...restOfFormik
    } = formik;
    const fieldObj = formik.getFieldProps({ name, ...props });
    const params = typeOf(props.params) === 'object' ? props.params : {};
    const meta = {
      value: getIn(formik.values, name),
      error: getIn(formik.errors, name),
      touched: !!getIn(formik.touched, name),
      initialValue: getIn(formik.initialValues, name),
      initialTouched: !!getIn(formik.initialTouched, name),
      initialError: getIn(formik.initialErrors, name),
    };

    return children({
      field: {
        ...fieldObj,
        ...params,
      },
      meta,
      form: restOfFormik,
    });
  }
}

export default connect(FastFieldInner);
