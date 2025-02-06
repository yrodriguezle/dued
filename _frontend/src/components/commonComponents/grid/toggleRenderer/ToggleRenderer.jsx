/* eslint-disable func-names */
import './ToggleRenderer.css';

export default function ToggleRenderer() {
}

ToggleRenderer.prototype.init = function (params) {
  this.eGui = document.createElement('div');
  this.eGui.innerHTML = (`
    <div class="container-toggle">
      <label class="switch">
        <input type="checkbox" disabled ${params.value === 1 || params.value === true ? 'checked' : ''} />
        <span class="slider round" />
      </label>
    </div>
  `);
};

ToggleRenderer.prototype.getGui = function () {
  return this.eGui;
};
