import Controller from "@ember/controller";
import { action } from "@ember/object";
import { tracked } from "@glimmer/tracking";

export default class AdminPluginsProjectUniformController extends Controller {
  @tracked tentacleVisible = false;

  @action
  showTentacle() {
    this.tentacleVisible = true;
  }
}
