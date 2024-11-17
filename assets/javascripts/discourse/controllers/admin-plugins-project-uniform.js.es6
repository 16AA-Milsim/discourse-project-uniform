import Controller from "@ember/controller";
import { action } from "@ember/object";
import { tracked } from "@glimmer/tracking";
import { ajax } from "discourse/lib/ajax"; // Import the ajax helper

export default class AdminPluginsProjectUniformController extends Controller {
  // Tracked properties for each uniform type
  @tracked uniformImagePreviewBritishArmyEnlisted = localStorage.getItem('projectUniformImageEnlisted') || null;
  @tracked uniformImagePreviewBritishArmyOfficers = localStorage.getItem('projectUniformImageOfficers') || null;
  @tracked uniformImagePreviewRAFEnlisted = localStorage.getItem('projectUniformImageRAFEnlisted') || null;
  @tracked uniformImagePreviewRAFOfficers = localStorage.getItem('projectUniformImageRAFOfficers') || null;

  // British Army Enlisted
  @action
  triggerFileUploadEnlisted() {
    document.getElementById('uniform-image-upload-enlisted').click();
  }

  @action
  handleUniformImageUploadEnlisted(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.uniformImagePreviewBritishArmyEnlisted = reader.result;
        localStorage.setItem('projectUniformImageEnlisted', reader.result);
      };
      reader.readAsDataURL(file);
    }
  }

  @action
  deleteImageEnlisted() {
    this.uniformImagePreviewBritishArmyEnlisted = null;
    localStorage.removeItem('projectUniformImageEnlisted');
  }

  // British Army Officers
  @action
  triggerFileUploadOfficers() {
    document.getElementById('uniform-image-upload-officers').click();
  }

  @action
  handleUniformImageUploadOfficers(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.uniformImagePreviewBritishArmyOfficers = reader.result;
        localStorage.setItem('projectUniformImageOfficers', reader.result);
      };
      reader.readAsDataURL(file);
    }
  }

  @action
  deleteImageOfficers() {
    this.uniformImagePreviewBritishArmyOfficers = null;
    localStorage.removeItem('projectUniformImageOfficers');
  }

  // Royal Air Force Enlisted
  @action
  triggerFileUploadRAFEnlisted() {
    document.getElementById('uniform-image-upload-raf-enlisted').click();
  }

  @action
  handleUniformImageUploadRAFEnlisted(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.uniformImagePreviewRAFEnlisted = reader.result;
        localStorage.setItem('projectUniformImageRAFEnlisted', reader.result);
      };
      reader.readAsDataURL(file);
    }
  }

  @action
  deleteImageRAFEnlisted() {
    this.uniformImagePreviewRAFEnlisted = null;
    localStorage.removeItem('projectUniformImageRAFEnlisted');
  }

  // Royal Air Force Officers
  @action
  triggerFileUploadRAFOfficers() {
    document.getElementById('uniform-image-upload-raf-officers').click();
  }

  @action
  handleUniformImageUploadRAFOfficers(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.uniformImagePreviewRAFOfficers = reader.result;
        localStorage.setItem('projectUniformImageRAFOfficers', reader.result);
      };
      reader.readAsDataURL(file);
    }
  }

  @action
  deleteImageRAFOfficers() {
    this.uniformImagePreviewRAFOfficers = null;
    localStorage.removeItem('projectUniformImageRAFOfficers');
  }

  // Optional shared upload method (if needed for background/other images)
  uploadImage(file, settingKey) {
    return new Promise((resolve, reject) => {
      if (!file) {
        return reject("No file selected for upload.");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_type", "site_setting");

      ajax("/uploads.json", {
        method: "POST",
        data: formData,
        processData: false,
        contentType: false
      })
      .then((response) => {
        if (response && response.url) {
          const imageUrl = response.url.startsWith("//")
            ? `${window.location.protocol}${response.url}`
            : response.url;

          // Save the URL to the site setting
          return ajax(`/admin/site_settings/${settingKey}`, {
            method: "PUT",
            data: { value: imageUrl }
          }).then(() => resolve(imageUrl));
        } else {
          throw new Error("Image upload failed.");
        }
      })
      .catch(reject);
    });
  }
}
