import Controller from "@ember/controller";
import { action } from "@ember/object";
import { tracked } from "@glimmer/tracking";
import { ajax } from "discourse/lib/ajax"; // Import the ajax helper

export default class AdminPluginsProjectUniformController extends Controller {
  @tracked projectUniformEnabled = Discourse.SiteSettings.project_uniform_enabled;
  @tracked projectUniformAdminOnly = Discourse.SiteSettings.project_uniform_admin_only;
  @tracked backgroundImage = Discourse.SiteSettings.project_uniform_image_upload; // Assuming this is your background image setting
  @tracked foregroundImage = Discourse.SiteSettings.project_uniform_foreground_image_upload; // New setting for foreground image

  @action
  toggleProjectUniform(event) {
    this.projectUniformEnabled = event.target.checked;
    this.updateSetting("project_uniform_enabled", this.projectUniformEnabled ? "true" : "false");
  }

  @action
  toggleAdminOnly(event) {
    this.projectUniformAdminOnly = event.target.checked;
    this.updateSetting("project_uniform_admin_only", this.projectUniformAdminOnly ? "true" : "false");
  }

  updateSetting(settingKey, value) {
    ajax(`/admin/site_settings/${settingKey}`, {
      method: "PUT",
      data: { value }
    }).catch((error) => {
      console.error(`Failed to save setting: ${settingKey}`, error);
    });
  }

  @action
  handleBackgroundImageUpload(event) {
    this.uploadImage(event.target.files[0], "project_uniform_image_upload")
      .then((url) => {
        this.backgroundImage = url;
      })
      .catch((error) => {
        console.error("Failed to upload background image:", error);
      });
  }

  @action
  handleForegroundImageUpload(event) {
    this.uploadImage(event.target.files[0], "project_uniform_foreground_image_upload")
      .then((url) => {
        this.foregroundImage = url;
      })
      .catch((error) => {
        console.error("Failed to upload foreground image:", error);
      });
  }

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
