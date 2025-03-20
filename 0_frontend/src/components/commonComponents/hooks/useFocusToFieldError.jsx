import { useFormikContext } from 'formik';
import { useEffect } from 'react';
import { setFocus } from '../../../common/validators';

export const getFieldErrorNames = (formikErrors) => {
  const transformObjectToDotNotation = (obj, prefix = '', result = []) => {
    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      if (!value) return;

      const nextKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object') {
        transformObjectToDotNotation(value, nextKey, result);
      } else {
        result.push(nextKey);
      }
    });
    return result;
  };

  return transformObjectToDotNotation(formikErrors);
};

function useFocusToFieldError() {
  const { isValid, errors, submitCount } = useFormikContext();
  useEffect(() => {
    if (submitCount > 0 && !isValid) {
      const [firstFieldError] = getFieldErrorNames(errors);
      if (firstFieldError) {
        setTimeout(() => {
          const element = setFocus(firstFieldError);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 10);
      }
    }
  }, [errors, isValid, submitCount]);
}

export default useFocusToFieldError;
