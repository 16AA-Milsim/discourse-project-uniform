import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class ImageContainerComponent extends Component {
  @tracked imagePreview = null;

  constructor() {
    super(...arguments);
    // Initialize image preview from a passed argument or fallback
    this.imagePreview = this.args.initialPreview || null;
  }

  @action
  triggerFileUpload() {
    document.getElementById(this.args.inputId).click();
  }

  @action
  handleImageUpload(event) {
    if (typeof this.args.onFileUpload === 'function') {
      // Delegate the upload handling to the provided action
      this.args.onFileUpload(event, this.args.imageKey);
    } else {
      console.error("No 'onFileUpload' action provided.");
    }
  }

  @action
  deleteImage() {
    this.imagePreview = null;
    if (typeof this.args.onDeleteImage === 'function') {
      this.args.onDeleteImage(this.args.imageKey);
    }
  }
}
