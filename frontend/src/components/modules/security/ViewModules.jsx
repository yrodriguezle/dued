import React from 'react';
import { Formik } from 'formik';
import FormToolbar from '../../commonComponents/formComponents/FormToolbar';
import FormPanel from '../../commonComponents/formComponents/FormPanel';
import FormModules from './modules/FormModules';

function ViewModules() {
  return (
    <Formik
      enableReinitialize
      initialValues={{}}
      initialStatus={{
        formStatus: 'INSERT',
        isFormLocked: false,
      }}
    >
      <>
        <FormToolbar />
        <div style={{ padding: 10, height: '100%' }}>
          <FormPanel
            header="Gentione moduli"
            id="form-panel-app-modules"
          >
            <FormModules />
          </FormPanel>
        </div>
      </>
    </Formik>
  );
}

export default ViewModules;
