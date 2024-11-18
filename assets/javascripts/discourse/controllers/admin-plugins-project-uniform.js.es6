import Controller from "@ember/controller";
import { action } from "@ember/object";
import { tracked } from "@glimmer/tracking";
import { ajax } from "discourse/lib/ajax";

export default class AdminPluginsProjectUniformController extends Controller {
  // Uniforms and ranks definitions as data arrays
  uniforms = [
    { name: 'BA Officers', key: 'ba_officers' },
    { name: 'BA Enlisted', key: 'ba_enlisted' },
    { name: 'RAF Officers', key: 'raf_officers' },
    { name: 'RAF Enlisted', key: 'raf_enlisted' }
  ];

  britishArmyRanks = [
    { name: 'Maj', key: 'maj' },
    { name: 'Capt', key: 'capt' },
    { name: 'Lt', key: 'lt' },
    { name: '2Lt', key: '2lt' },
    { name: 'WO1', key: 'wo1' },
    { name: 'WO2', key: 'wo2' },
    { name: 'CSgt/SSgt', key: 'csjt_ssjt' },
    { name: 'Sgt', key: 'sgt' },
    { name: 'Cpl/Bdr', key: 'cpl_bdr' },
    { name: 'LCpl/LBdr', key: 'lcpl_lbdr' },
    { name: 'Pte/Gnr', key: 'pte_gnr' },
    { name: 'Rec', key: 'rec' }
  ];

  rafRanks = [
    { name: 'Sqn Ldr', key: 'sqn_ldr' },
    { name: 'Flt Lt', key: 'flt_lt' },
    { name: 'Fg Off', key: 'fg_off' },
    { name: 'Plt Off', key: 'plt_off' },
    { name: 'FSAcr', key: 'fsacr' },
    { name: 'SAcr', key: 'sacr' }
  ];

  capBadges = [
    { name: 'Para', key: 'para' },
    { name: 'RAMC', key: 'ramc' }
  ];

  // Tracked properties for image previews
  @tracked imagePreviews = {};

  // Fetch stored images when the controller initializes
  constructor() {
    super(...arguments);
    this.loadStoredImages();
  }

  loadStoredImages() {
    const allKeys = [
      ...this.uniforms.map((item) => item.key),
      ...this.britishArmyRanks.map((item) => item.key),
      ...this.rafRanks.map((item) => item.key),
      ...this.capBadges.map((item) => item.key)
    ];
    allKeys.forEach((key) => {
      // Try without .json if not working
      ajax(`/admin/site_settings/${key}`, { method: "GET" })
        .then((response) => {
          if (response && (response.value || typeof response === 'string')) {
            this.imagePreviews[key] = response.value || response;
          } else {
            console.warn(`No valid value for key ${key}`);
            this.imagePreviews[key] = null;
          }
        })
        .catch((error) => {
          console.error(`Failed to load image for ${key}:`, error);
        });
    });
  }

  @action
  handleFileUpload(event, imageKey) {
    const file = event.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_type", "site_setting");
      formData.append("for_site_setting", "true");
      formData.append("client_id", "yourClientID");  
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
  
          // Save the URL to the relevant site setting for persistence
          return ajax(`/admin/site_settings/${imageKey}`, {
            method: "PUT",
            data: { value: imageUrl }
          }).then(() => {
            console.log(`Image for ${imageKey} saved successfully.`);
            this.imagePreviews[imageKey] = imageUrl;
            console.log(`Image URL saved successfully for ${imageKey}:`, imageUrl);
          }).catch((error) => {
            console.error(`Failed to save site setting for ${imageKey}:`, error);
          });
        } else {
          throw new Error("Image upload failed.");
        }
      })
      .catch((error) => {
        console.error("Image upload failed:", error);
      });
    }
  }  
}