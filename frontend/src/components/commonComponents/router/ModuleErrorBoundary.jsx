import React, { Component } from 'react';
import appMessages from '../../../messages/appMessages';

class ModuleErrorBoundary extends Component {
  constructor() {
    super();
    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>{appMessages.routesError.body}</div>
      );
    }

    return this.props.children;
  }
}

export default ModuleErrorBoundary;
